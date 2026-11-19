#ifndef EXECOS_TRACING_TRACE_H
#define EXECOS_TRACING_TRACE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define EXECOS_TRACE_CAPACITY 64

enum trace_event_type {
    TRACE_TIMER_INTERRUPT,
    TRACE_CONTEXT_SWITCH,
    TRACE_PROCESS_CREATE,
    TRACE_PROCESS_EXIT,
    TRACE_EXCEPTION,
    TRACE_FILE_CREATE,
    TRACE_FILE_REMOVE,
    TRACE_FILE_RENAME,
    TRACE_FILE_OPEN,
    TRACE_FILE_READ,
    TRACE_FILE_WRITE
};

struct trace_event {
    uint64_t sequence;
    uint64_t tick;
    uint64_t source_pid;
    uint64_t target_pid;
    uint64_t detail;
    enum trace_event_type type;
};

bool trace_initialize(void);
bool trace_record(
    enum trace_event_type type,
    uint64_t tick,
    uint64_t source_pid,
    uint64_t target_pid,
    uint64_t detail
);
size_t trace_count(void);
bool trace_get(size_t index, struct trace_event *event);

#endif
