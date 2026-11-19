#ifndef EXECOS_SHELL_H
#define EXECOS_SHELL_H

#include <stdbool.h>

bool shell_execute_line(char *line);
void shell_run(void) __attribute__((noreturn));

#endif
