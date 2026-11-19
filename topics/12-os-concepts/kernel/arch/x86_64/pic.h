#ifndef EXECOS_ARCH_X86_64_PIC_H
#define EXECOS_ARCH_X86_64_PIC_H

#include <stdbool.h>
#include <stdint.h>

void pic_initialize(void);
void pic_mask_irq(uint8_t irq);
void pic_unmask_irq(uint8_t irq);
void pic_send_eoi(uint8_t irq);
bool pit_timer_initialize(uint32_t frequency_hz);
uint64_t pit_timer_ticks(void);
void pit_timer_interrupt(void);

#endif
