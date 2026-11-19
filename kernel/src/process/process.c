#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "arch/x86_64/idt.h"
#include "process/process.h"
#include "scheduler/scheduler.h"
#include "tracing/trace.h"

static struct process processes[PROCESS_MAX_COUNT];
static size_t process_total;
static size_t current_process_index;
static uint64_t next_pid;

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

uintptr_t process_bootstrap_stack_top;
extern void process_first_entry(void);
void process_kernel_thread_start(void) __attribute__((noreturn));

static size_t string_length(const char *value) {
    size_t length = 0;
    while (value[length] != '\0') {
        length++;
    }
    return length;
}

static void copy_name(char destination[PROCESS_NAME_MAX_LENGTH + 1], const char *source) {
    size_t length = string_length(source);
    if (length > PROCESS_NAME_MAX_LENGTH) {
        length = PROCESS_NAME_MAX_LENGTH;
    }
    for (size_t index = 0; index < length; index++) {
        destination[index] = source[index];
    }
    destination[length] = '\0';
}

bool process_initialize(void) {
    if (process_total != 0) {
        return false;
    }
    processes[0].pid = 1;
    processes[0].parent_pid = 0;
    processes[0].state = PROCESS_RUNNING;
    processes[0].priority = 3;
    copy_name(processes[0].name, "kernel");
    processes[0].entry = NULL;
    processes[0].argument = NULL;
    processes[0].saved_stack = 0;
    processes[0].arrival_time = 0;
    processes[0].start_time = 0;
    processes[0].completion_time = 0;
    processes[0].waiting_time = 0;
    processes[0].turnaround_time = 0;
    processes[0].response_time = 0;
    processes[0].cpu_ticks = 0;
    processes[0].exit_status = 0;
    processes[0].started = true;
    current_process_index = 0;
    process_total = 1;
    next_pid = 2;
    return true;
}

uint64_t process_create_kernel_thread(
    const char *name,
    process_entry_t entry,
    void *argument,
    uint8_t priority
) {
    if (!name || name[0] == '\0' || !entry ||
        priority < 1 || priority > 5) {
        return 0;
    }

    uint64_t interrupt_flags = disable_interrupts();
    size_t process_index = process_total;
    for (size_t index = 1; index < process_total; index++) {
        if (processes[index].state == PROCESS_TERMINATED) {
            process_index = index;
            break;
        }
    }
    if (process_index == process_total &&
        process_total >= PROCESS_MAX_COUNT) {
        restore_interrupts(interrupt_flags);
        return 0;
    }
    struct process *process = &processes[process_index];
    process->pid = next_pid++;
    process->parent_pid = processes[current_process_index].pid;
    process->state = PROCESS_NEW;
    process->priority = priority;
    copy_name(process->name, name);
    process->entry = entry;
    process->argument = argument;
    process->arrival_time = scheduler_tick_count();
    process->start_time = 0;
    process->completion_time = 0;
    process->waiting_time = 0;
    process->turnaround_time = 0;
    process->response_time = 0;
    process->cpu_ticks = 0;
    process->exit_status = 0;
    process->started = false;

    uintptr_t stack_top = (uintptr_t)(process->kernel_stack + sizeof(process->kernel_stack));
    stack_top &= ~(uintptr_t)0xf;
    uintptr_t initial_stack = stack_top - sizeof(uint64_t) -
        sizeof(struct x86_interrupt_frame);
    struct x86_interrupt_frame *frame =
        (struct x86_interrupt_frame *)initial_stack;
    uint16_t code_segment;
    __asm__ volatile ("mov %%cs, %0" : "=r"(code_segment));
    *frame = (struct x86_interrupt_frame) {
        .vector = 0,
        .error_code = 0,
        .instruction_pointer = (uintptr_t)process_first_entry,
        .code_segment = code_segment,
        .rflags = 0x202
    };
    process->saved_stack = initial_stack;
    process->state = PROCESS_READY;
    if (process_index == process_total) {
        process_total++;
    }
    trace_record(
        TRACE_PROCESS_CREATE,
        scheduler_tick_count(),
        process->parent_pid,
        process->pid,
        priority
    );
    restore_interrupts(interrupt_flags);
    return process->pid;
}

bool process_terminate(uint64_t pid, int32_t exit_status) {
    uint64_t interrupt_flags = disable_interrupts();
    struct process *current = process_current();
    struct process *target = NULL;
    for (size_t index = 1; index < process_total; index++) {
        if (processes[index].pid == pid) {
            target = &processes[index];
            break;
        }
    }
    if (!target || target == current ||
        target->state == PROCESS_TERMINATED) {
        restore_interrupts(interrupt_flags);
        return false;
    }

    uint64_t tick = scheduler_tick_count();
    target->exit_status = exit_status;
    target->completion_time = tick;
    target->turnaround_time =
        tick >= target->arrival_time ? tick - target->arrival_time : 0;
    target->state = PROCESS_TERMINATED;
    uint64_t source_pid = current ? current->pid : 0;
    trace_record(TRACE_PROCESS_EXIT, tick, source_pid, pid, (uint32_t)exit_status);
    restore_interrupts(interrupt_flags);
    return true;
}

size_t process_count(void) {
    return process_total;
}

struct process *process_get(size_t index) {
    return index < process_total ? &processes[index] : NULL;
}

struct process *process_current(void) {
    return process_get(current_process_index);
}

size_t process_current_index(void) {
    return current_process_index;
}

bool process_set_current(size_t index) {
    if (index >= process_total) {
        return false;
    }
    current_process_index = index;
    return true;
}

void process_prepare_first_run(const struct process *process) {
    if (!process) {
        return;
    }
    process_bootstrap_stack_top =
        (uintptr_t)(process->kernel_stack + sizeof(process->kernel_stack));
}

void process_exit_current(int32_t exit_status) {
    struct process *process = process_current();
    if (!process || process->pid == 1 || process->state == PROCESS_TERMINATED) {
        for (;;) {
            __asm__ volatile ("cli; hlt");
        }
    }
    process->state = PROCESS_TERMINATED;
    process->exit_status = exit_status;
    process->completion_time = scheduler_tick_count();
    process->turnaround_time = process->completion_time - process->arrival_time;
    trace_record(
        TRACE_PROCESS_EXIT,
        process->completion_time,
        process->pid,
        0,
        (uint32_t)exit_status
    );
    for (;;) {
        __asm__ volatile ("sti; hlt" : : : "memory");
    }
}

void process_kernel_thread_start(void) {
    struct process *process = process_current();
    if (process && process->entry) {
        process->entry(process->argument);
    }
    process_exit_current(0);
}
