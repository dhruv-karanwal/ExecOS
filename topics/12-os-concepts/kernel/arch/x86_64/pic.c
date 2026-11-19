#include <stdint.h>

#include "arch/x86_64/pic.h"

#define PIC1_COMMAND 0x20
#define PIC1_DATA 0x21
#define PIC2_COMMAND 0xa0
#define PIC2_DATA 0xa1
#define PIC_EOI 0x20
#define PIC_ICW1_INIT 0x10
#define PIC_ICW1_ICW4 0x01
#define PIC_ICW4_8086 0x01

#define PIT_CHANNEL_0 0x40
#define PIT_COMMAND 0x43
#define PIT_BASE_FREQUENCY 1193182U
#define PIT_MAX_DIVISOR 65536U

static volatile uint64_t timer_ticks;
static uint8_t master_mask = 0xff;
static uint8_t slave_mask = 0xff;

static void outb(uint16_t port, uint8_t value) {
    __asm__ volatile ("outb %0, %1" : : "a"(value), "Nd"(port));
}

static void io_wait(void) {
    outb(0x80, 0);
}

void pic_initialize(void) {
    __asm__ volatile ("cli" : : : "memory");
    outb(PIC1_DATA, 0xff);
    outb(PIC2_DATA, 0xff);

    outb(PIC1_COMMAND, PIC_ICW1_INIT | PIC_ICW1_ICW4);
    io_wait();
    outb(PIC2_COMMAND, PIC_ICW1_INIT | PIC_ICW1_ICW4);
    io_wait();
    outb(PIC1_DATA, 0x20);
    io_wait();
    outb(PIC2_DATA, 0x28);
    io_wait();
    outb(PIC1_DATA, 1U << 2);
    io_wait();
    outb(PIC2_DATA, 2);
    io_wait();
    outb(PIC1_DATA, PIC_ICW4_8086);
    io_wait();
    outb(PIC2_DATA, PIC_ICW4_8086);
    io_wait();

    outb(PIC2_DATA, slave_mask);
    outb(PIC1_DATA, master_mask);
}

void pic_mask_irq(uint8_t irq) {
    if (irq >= 16) {
        return;
    }
    if (irq < 8) {
        master_mask |= (uint8_t)(1U << irq);
        outb(PIC1_DATA, master_mask);
    } else {
        slave_mask |= (uint8_t)(1U << (irq - 8));
        outb(PIC2_DATA, slave_mask);
    }
}

void pic_unmask_irq(uint8_t irq) {
    if (irq >= 16) {
        return;
    }
    if (irq < 8) {
        master_mask &= (uint8_t)~(1U << irq);
        outb(PIC1_DATA, master_mask);
    } else {
        slave_mask &= (uint8_t)~(1U << (irq - 8));
        outb(PIC2_DATA, slave_mask);
    }
}

void pic_send_eoi(uint8_t irq) {
    if (irq >= 8) {
        outb(PIC2_COMMAND, PIC_EOI);
    }
    outb(PIC1_COMMAND, PIC_EOI);
}

bool pit_timer_initialize(uint32_t frequency_hz) {
    if (frequency_hz == 0 || frequency_hz > PIT_BASE_FREQUENCY) {
        return false;
    }
    uint32_t divisor = PIT_BASE_FREQUENCY / frequency_hz;
    if (divisor == 0 || divisor > PIT_MAX_DIVISOR) {
        return false;
    }

    timer_ticks = 0;
    uint16_t reload = divisor == PIT_MAX_DIVISOR ? 0 : (uint16_t)divisor;
    outb(PIT_COMMAND, 0x36);
    outb(PIT_CHANNEL_0, (uint8_t)(reload & 0xff));
    outb(PIT_CHANNEL_0, (uint8_t)(reload >> 8));
    return true;
}

uint64_t pit_timer_ticks(void) {
    return timer_ticks;
}

void pit_timer_interrupt(void) {
    timer_ticks++;
}
