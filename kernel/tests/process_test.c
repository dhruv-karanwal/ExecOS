#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

#include "arch/x86_64/idt.h"
#include "process/process.h"
#include "scheduler/scheduler.h"

#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 1; \
    } \
} while (0)

static void unused_entry(void *argument) {
    (void)argument;
}

void process_first_entry(void) {
}

int main(void) {
    CHECK(process_initialize());
    CHECK(!process_initialize());
    CHECK(process_count() == 1);
    CHECK(process_current()->pid == 1);
    CHECK(process_current()->state == PROCESS_RUNNING);

    uint64_t first_pid = process_create_kernel_thread("worker-a", unused_entry, NULL, 3);
    uint64_t second_pid = process_create_kernel_thread("worker-b", unused_entry, NULL, 2);
    CHECK(first_pid == 2);
    CHECK(second_pid == 3);
    CHECK(process_create_kernel_thread("invalid", unused_entry, NULL, 0) == 0);
    CHECK(process_create_kernel_thread("invalid", NULL, NULL, 3) == 0);
    CHECK(process_count() == 3);
    CHECK(process_get(3) == NULL);
    CHECK(process_get(1)->state == PROCESS_READY);
    CHECK(process_get(1)->parent_pid == 1);
    CHECK(process_get(1)->priority == 3);
    CHECK(process_get(1)->saved_stack != 0);
    CHECK((process_get(1)->saved_stack & 0x7) == 0);

    struct x86_interrupt_frame *first_context =
        (struct x86_interrupt_frame *)process_get(1)->saved_stack;
    CHECK(first_context->code_segment != 0);
    CHECK(first_context->rflags == 0x202);

    CHECK(scheduler_initialize());
    CHECK(scheduler_quantum() == 1);
    CHECK(!scheduler_set_quantum(0));
    CHECK(scheduler_set_quantum(2));
    struct x86_interrupt_frame tick_frame = {0};
    uintptr_t first_tick_stack = scheduler_on_timer(&tick_frame);
    CHECK(first_tick_stack == (uintptr_t)&tick_frame);
    CHECK(process_current_index() == 0);
    CHECK(process_get(0)->state == PROCESS_RUNNING);
    CHECK(process_get(1)->waiting_time == 1);
    CHECK(scheduler_tick_count() == 1);

    struct x86_interrupt_frame second_tick_frame = {0};
    uintptr_t second_tick_stack = scheduler_on_timer(&second_tick_frame);
    CHECK(second_tick_stack == process_get(1)->saved_stack);
    CHECK(process_current_index() == 1);
    CHECK(process_get(1)->state == PROCESS_RUNNING);
    CHECK(process_get(0)->waiting_time == 1);

    struct x86_interrupt_frame third_tick_frame = {0};
    CHECK(scheduler_on_timer(&third_tick_frame) == (uintptr_t)&third_tick_frame);
    CHECK(process_current_index() == 1);
    CHECK(process_get(1)->state == PROCESS_RUNNING);
    CHECK(process_get(1)->cpu_ticks == 1);
    CHECK(scheduler_tick_count() == 3);

    struct x86_interrupt_frame fourth_tick_frame = {0};
    uintptr_t fourth_tick_stack = scheduler_on_timer(&fourth_tick_frame);
    CHECK(fourth_tick_stack == process_get(2)->saved_stack);
    CHECK(process_current_index() == 2);
    CHECK(process_get(2)->state == PROCESS_RUNNING);

    struct x86_interrupt_frame fifth_tick_frame = {0};
    CHECK(scheduler_on_timer(&fifth_tick_frame) == (uintptr_t)&fifth_tick_frame);
    CHECK(process_current_index() == 2);
    CHECK(process_get(2)->cpu_ticks == 1);
    CHECK(process_get(0)->waiting_time == 4);

    struct x86_interrupt_frame sixth_tick_frame = {0};
    CHECK(scheduler_on_timer(&sixth_tick_frame) == (uintptr_t)&second_tick_frame);
    CHECK(process_current_index() == 0);
    CHECK(process_get(0)->state == PROCESS_RUNNING);
    CHECK(process_get(2)->state == PROCESS_READY);
    CHECK(scheduler_tick_count() == 6);
    CHECK(process_get(1)->cpu_ticks == 2);
    CHECK(process_get(2)->cpu_ticks == 2);
    CHECK(process_get(1)->start_time == 2);
    CHECK(process_get(2)->start_time == 4);
    CHECK(process_get(1)->waiting_time > 0);
    CHECK(process_get(2)->waiting_time > 0);
    CHECK(scheduler_context_switch_count() == 3);
    CHECK(scheduler_set_quantum(1));
    CHECK(!process_set_current(PROCESS_MAX_COUNT));
    CHECK(!process_terminate(1, 0));
    CHECK(process_terminate(second_pid, -1));
    CHECK(process_get(2)->state == PROCESS_TERMINATED);
    CHECK(process_get(2)->exit_status == -1);
    CHECK(process_get(2)->completion_time == 6);
    CHECK(process_get(2)->turnaround_time == 6);
    CHECK(!process_terminate(second_pid, 0));

    struct x86_interrupt_frame seventh_tick_frame = {0};
    CHECK(scheduler_on_timer(&seventh_tick_frame) == process_get(1)->saved_stack);
    CHECK(process_current_index() == 1);
    struct x86_interrupt_frame eighth_tick_frame = {0};
    CHECK(scheduler_on_timer(&eighth_tick_frame) == (uintptr_t)&seventh_tick_frame);
    CHECK(process_current_index() == 0);
    CHECK(process_terminate(first_pid, -1));
    struct x86_interrupt_frame ninth_tick_frame = {0};
    CHECK(scheduler_on_timer(&ninth_tick_frame) == (uintptr_t)&ninth_tick_frame);
    CHECK(process_current_index() == 0);

    uint64_t replacement_pid =
        process_create_kernel_thread("worker-replacement", unused_entry, NULL, 3);
    CHECK(replacement_pid > second_pid);
    CHECK(process_get(1)->pid == replacement_pid);
    CHECK(process_get(1)->state == PROCESS_READY);

    while (process_count() < PROCESS_MAX_COUNT) {
        char worker_name[] = "extra";
        CHECK(process_create_kernel_thread(worker_name, unused_entry, NULL, 1) != 0);
    }
    CHECK(process_create_kernel_thread("overflow", unused_entry, NULL, 1) == 0);

    puts("Kernel process and round-robin scheduler tests passed.");
    return 0;
}
