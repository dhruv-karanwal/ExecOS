#ifndef EXECOS_ARCH_X86_64_SERIAL_H
#define EXECOS_ARCH_X86_64_SERIAL_H

#include <stdbool.h>
#include <stdint.h>

void serial_initialize(void);
bool serial_try_read_character(char *character);
void serial_write_text(const char *text);
void serial_write_line(const char *text);
void serial_write_u64(uint64_t value);
void serial_write_hex(uint64_t value);

#endif
