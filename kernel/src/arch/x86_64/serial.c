#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "serial.h"

#define COM1 0x3F8
#define COM1_LINE_STATUS (COM1 + 5)
#define COM1_DATA_READY 0x01
#define COM1_TRANSMIT_EMPTY 0x20

static void outb(uint16_t port, uint8_t value) {
    __asm__ volatile ("outb %0, %1" : : "a"(value), "Nd"(port));
}

static uint8_t inb(uint16_t port) {
    uint8_t value;
    __asm__ volatile ("inb %1, %0" : "=a"(value) : "Nd"(port));
    return value;
}

static void serial_write_character(char character) {
    while ((inb(COM1_LINE_STATUS) & COM1_TRANSMIT_EMPTY) == 0) {
    }
    outb(COM1, (uint8_t)character);
}

void serial_initialize(void) {
    outb(COM1 + 1, 0x00);
    outb(COM1 + 3, 0x80);
    outb(COM1, 0x03);
    outb(COM1 + 1, 0x00);
    outb(COM1 + 3, 0x03);
    outb(COM1 + 2, 0xC7);
    outb(COM1 + 4, 0x0B);
}

bool serial_try_read_character(char *character) {
    if (!character || (inb(COM1_LINE_STATUS) & COM1_DATA_READY) == 0) {
        return false;
    }
    *character = (char)inb(COM1);
    return true;
}

void serial_write_line(const char *text) {
    serial_write_text(text);
    serial_write_character('\r');
    serial_write_character('\n');
}

void serial_write_text(const char *text) {
    while (*text != '\0') {
        if (*text == '\n') {
            serial_write_character('\r');
        }
        serial_write_character(*text++);
    }
}

void serial_write_u64(uint64_t value) {
    char digits[20];
    size_t length = 0;
    do {
        digits[length++] = (char)('0' + value % 10);
        value /= 10;
    } while (value != 0);
    while (length > 0) {
        serial_write_character(digits[--length]);
    }
}

void serial_write_hex(uint64_t value) {
    static const char digits[] = "0123456789abcdef";
    serial_write_text("0x");
    bool started = false;
    for (int shift = 60; shift >= 0; shift -= 4) {
        uint8_t digit = (uint8_t)((value >> shift) & 0xf);
        if (digit != 0 || started || shift == 0) {
            serial_write_character(digits[digit]);
            started = true;
        }
    }
}
