#include <stddef.h>
#include <stdint.h>

#include "arch/x86_64/idt.h"
#include "arch/x86_64/pic.h"
#include "arch/x86_64/serial.h"
#include "scheduler/scheduler.h"
#include "tracing/trace.h"

#define IDT_ENTRY_COUNT 256
#define IDT_INTERRUPT_GATE 0x8e

struct idt_gate {
    uint16_t offset_low;
    uint16_t selector;
    uint8_t interrupt_stack;
    uint8_t attributes;
    uint16_t offset_middle;
    uint32_t offset_high;
    uint32_t reserved;
} __attribute__((packed));

struct idt_register {
    uint16_t limit;
    uint64_t base;
} __attribute__((packed));

static struct idt_gate idt[IDT_ENTRY_COUNT] __attribute__((aligned(16)));

extern void (*exception_stub_table[32])(void);
extern void (*irq_stub_table[16])(void);
extern void exception_default_stub(void);

static const char *const exception_names[32] = {
    "Divide error",
    "Debug",
    "Non-maskable interrupt",
    "Breakpoint",
    "Overflow",
    "Bound range exceeded",
    "Invalid opcode",
    "Device not available",
    "Double fault",
    "Coprocessor segment overrun",
    "Invalid TSS",
    "Segment not present",
    "Stack-segment fault",
    "General protection fault",
    "Page fault",
    "Reserved exception",
    "x87 floating-point exception",
    "Alignment check",
    "Machine check",
    "SIMD floating-point exception",
    "Virtualization exception",
    "Control-protection exception",
    "Reserved exception",
    "Reserved exception",
    "Reserved exception",
    "Reserved exception",
    "Reserved exception",
    "Reserved exception",
    "Hypervisor-injection exception",
    "VMM communication exception",
    "Security exception",
    "Reserved exception",
};

static void idt_set_gate(uint8_t vector, uintptr_t handler, uint16_t selector) {
    idt[vector] = (struct idt_gate) {
        .offset_low = (uint16_t)handler,
        .selector = selector,
        .interrupt_stack = 0,
        .attributes = IDT_INTERRUPT_GATE,
        .offset_middle = (uint16_t)(handler >> 16),
        .offset_high = (uint32_t)(handler >> 32),
        .reserved = 0,
    };
}

static void write_exception_report(const struct x86_interrupt_frame *frame) {
    serial_write_text("ExecOS exception: vector ");
    serial_write_u64(frame->vector);
    serial_write_text(" (");
    if (frame->vector < 32) {
        serial_write_text(exception_names[frame->vector]);
    } else {
        serial_write_text("unexpected interrupt");
    }
    serial_write_line(")");
    serial_write_text("Error code: ");
    serial_write_hex(frame->error_code);
    serial_write_line("");
    serial_write_text("Instruction pointer: ");
    serial_write_hex(frame->instruction_pointer);
    serial_write_line("");
}

bool idt_initialize(void) {
    uint16_t code_segment;
    __asm__ volatile ("mov %%cs, %0" : "=r"(code_segment));
    for (uint16_t vector = 0; vector < IDT_ENTRY_COUNT; vector++) {
        idt_set_gate((uint8_t)vector, (uintptr_t)exception_default_stub, code_segment);
    }
    for (uint16_t vector = 0; vector < 32; vector++) {
        idt_set_gate((uint8_t)vector, (uintptr_t)exception_stub_table[vector], code_segment);
    }
    for (uint16_t irq = 0; irq < 16; irq++) {
        idt_set_gate((uint8_t)(32 + irq), (uintptr_t)irq_stub_table[irq], code_segment);
    }

    struct idt_register idtr = {
        .limit = (uint16_t)(sizeof(idt) - 1),
        .base = (uintptr_t)idt,
    };
    __asm__ volatile ("lidt %0" : : "m"(idtr) : "memory");
    return true;
}

uintptr_t x86_interrupt_dispatch(struct x86_interrupt_frame *frame) {
    if (!frame) {
        serial_write_line("ExecOS interrupt: missing interrupt frame.");
        for (;;) {
            __asm__ volatile ("cli; hlt");
        }
    }
    if (frame->vector >= 32 && frame->vector < 48) {
        uint8_t irq = (uint8_t)(frame->vector - 32);
        if (irq == 0) {
            pit_timer_interrupt();
        } else {
            pic_mask_irq(irq);
            serial_write_text("ExecOS: unexpected PIC IRQ ");
            serial_write_u64(irq);
            serial_write_line("; masked; halting.");
            for (;;) {
                __asm__ volatile ("cli; hlt");
            }
        }
        pic_send_eoi(irq);
        if (irq == 0) {
            return scheduler_on_timer(frame);
        }
        return (uintptr_t)frame;
    }
    trace_record(
        TRACE_EXCEPTION,
        scheduler_tick_count(),
        0,
        0,
        frame->vector
    );
    write_exception_report(frame);
    if (frame->vector == 3) {
        serial_write_line("ExecOS: breakpoint handled; resuming kernel.");
        return (uintptr_t)frame;
    }
    serial_write_line("ExecOS: fatal CPU exception; halting.");
    for (;;) {
        __asm__ volatile ("cli; hlt");
    }
}
