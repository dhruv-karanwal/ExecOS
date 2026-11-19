#ifndef EXECOS_PROCESS_H
#define EXECOS_PROCESS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define PROCESS_MAX_COUNT 8
#define PROCESS_KERNEL_STACK_SIZE (16 * 1024)
#define PROCESS_NAME_MAX_LENGTH 31

enum process_state {
    PROCESS_NEW,
    PROCESS_READY,
    PROCESS_RUNNING,
    PROCESS_WAITING,
    PROCESS_TERMINATED
};

typedef void (*process_entry_t)(void *argument);
extern uintptr_t process_bootstrap_stack_top;

struct process {
    uint64_t pid;
    uint64_t parent_pid;
    enum process_state state;
    uint8_t priority;
    char name[PROCESS_NAME_MAX_LENGTH + 1];
    process_entry_t entry;
    void *argument;
    uintptr_t saved_stack;
    uint64_t arrival_time;
    uint64_t start_time;
    uint64_t completion_time;
    uint64_t waiting_time;
    uint64_t turnaround_time;
    uint64_t response_time;
    uint64_t cpu_ticks;
    int32_t exit_status;
    bool started;
    uint8_t kernel_stack[PROCESS_KERNEL_STACK_SIZE] __attribute__((aligned(16)));
};

bool process_initialize(void);
uint64_t process_create_kernel_thread(
    const char *name,
    process_entry_t entry,
    void *argument,
    uint8_t priority
);
bool process_terminate(uint64_t pid, int32_t exit_status);
size_t process_count(void);
struct process *process_get(size_t index);
struct process *process_current(void);
size_t process_current_index(void);
bool process_set_current(size_t index);
void process_prepare_first_run(const struct process *process);
void process_exit_current(int32_t exit_status) __attribute__((noreturn));

#endif
