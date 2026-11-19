#ifndef EXECOS_SCHEDULER_H
#define EXECOS_SCHEDULER_H

#include <stdbool.h>
#include <stdint.h>

struct x86_interrupt_frame;

bool scheduler_initialize(void);
uintptr_t scheduler_on_timer(struct x86_interrupt_frame *frame);
uint64_t scheduler_tick_count(void);
bool scheduler_set_quantum(uint64_t ticks);
uint64_t scheduler_quantum(void);
uint64_t scheduler_context_switch_count(void);

#endif
