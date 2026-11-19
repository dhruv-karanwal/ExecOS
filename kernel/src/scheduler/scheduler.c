#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "arch/x86_64/idt.h"
#include "process/process.h"
#include "scheduler/scheduler.h"
#include "tracing/trace.h"

static bool scheduler_ready;
static uint64_t scheduler_ticks;
static uint64_t scheduler_quantum_ticks;
static uint64_t quantum_elapsed;
static uint64_t context_switches;

static uint64_t disable_interrupts(void) {
#if defined(__STDC_HOSTED__) && __STDC_HOSTED__
    return 0;
#else
    uint64_t flags;
    __asm__ volatile ("pushfq; popq %0; cli" : "=r"(flags) : : "memory");
    return flags;
#endif
}

static void restore_interrupts(uint64_t flags) {
#if defined(__STDC_HOSTED__) && __STDC_HOSTED__
    (void)flags;
#else
    if ((flags & (1ULL << 9)) != 0) {
        __asm__ volatile ("sti" : : : "memory");
    }
#endif
}

bool scheduler_initialize(void) {
    if (scheduler_ready || process_count() == 0 || !process_current()) {
        return false;
    }
    scheduler_ticks = 0;
    scheduler_quantum_ticks = 1;
    quantum_elapsed = 0;
    context_switches = 0;
    scheduler_ready = true;
    return true;
}

uint64_t scheduler_tick_count(void) {
    return scheduler_ticks;
}

bool scheduler_set_quantum(uint64_t ticks) {
    if (ticks == 0) {
        return false;
    }
    uint64_t interrupt_flags = disable_interrupts();
    if (!scheduler_ready) {
        restore_interrupts(interrupt_flags);
        return false;
    }
    scheduler_quantum_ticks = ticks;
    quantum_elapsed = 0;
    restore_interrupts(interrupt_flags);
    return true;
}

uint64_t scheduler_quantum(void) {
    return scheduler_quantum_ticks;
}

uint64_t scheduler_context_switch_count(void) {
    return context_switches;
}

uintptr_t scheduler_on_timer(struct x86_interrupt_frame *frame) {
    if (!scheduler_ready || !frame) {
        return (uintptr_t)frame;
    }

    scheduler_ticks++;
    size_t current_index = process_current_index();
    struct process *current = process_get(current_index);
    if (!current) {
        return (uintptr_t)frame;
    }
    bool current_was_running = current->state == PROCESS_RUNNING;
    if (current->state == PROCESS_RUNNING) {
        current->saved_stack = (uintptr_t)frame;
        current->cpu_ticks++;
        current->state = PROCESS_READY;
        quantum_elapsed++;
    }
    trace_record(
        TRACE_TIMER_INTERRUPT,
        scheduler_ticks,
        current->pid,
        current->pid,
        0
    );

    size_t total = process_count();
    bool quantum_expired =
        !current_was_running || quantum_elapsed >= scheduler_quantum_ticks;
    size_t candidate_index = current_index;
    struct process *candidate = current;
    if (quantum_expired) {
        candidate = NULL;
        for (size_t offset = 1; offset <= total; offset++) {
            size_t index = (current_index + offset) % total;
            struct process *next = process_get(index);
            if (next && next->state == PROCESS_READY) {
                candidate = next;
                candidate_index = index;
                break;
            }
        }
    }
    if (!candidate || candidate->state != PROCESS_READY) {
        return (uintptr_t)frame;
    }

    for (size_t index = 0; index < total; index++) {
        struct process *waiting = process_get(index);
        if (waiting && waiting->state == PROCESS_READY &&
            index != candidate_index) {
            waiting->waiting_time++;
        }
    }
    if (!candidate->started) {
        process_prepare_first_run(candidate);
        candidate->started = true;
        candidate->start_time = scheduler_ticks;
        candidate->response_time =
            scheduler_ticks >= candidate->arrival_time
                ? scheduler_ticks - candidate->arrival_time
                : 0;
    }
    candidate->state = PROCESS_RUNNING;
    process_set_current(candidate_index);
    if (quantum_expired) {
        quantum_elapsed = 0;
    }
    if (candidate_index != current_index) {
        context_switches++;
        trace_record(
            TRACE_CONTEXT_SWITCH,
            scheduler_ticks,
            current->pid,
            candidate->pid,
            0
        );
    }
    return candidate->saved_stack;
}
