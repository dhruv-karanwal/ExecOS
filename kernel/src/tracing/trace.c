#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "tracing/trace.h"

static struct trace_event events[EXECOS_TRACE_CAPACITY];
static size_t next_event;
static size_t event_count;
static uint64_t next_sequence;
static bool initialized;

static uint64_t preserve_and_disable_interrupts(void) {
#if defined(__STDC_HOSTED__) && __STDC_HOSTED__
    return 0;
#else
    uint64_t flags;
    __asm__ volatile ("pushfq; popq %0; cli" : "=r"(flags) : : "memory");
    return flags;
#endif
}

static void restore_interrupts(uint64_t flags) {
#if defined(__STDC_HOSTED__) && __STDC_HOSTED__
    (void)flags;
#else
    if ((flags & (1ULL << 9)) != 0) {
        __asm__ volatile ("sti" : : : "memory");
    }
#endif
}

bool trace_initialize(void) {
    if (initialized) {
        return false;
    }
    next_event = 0;
    event_count = 0;
    next_sequence = 1;
    initialized = true;
    return true;
}

bool trace_record(
    enum trace_event_type type,
    uint64_t tick,
    uint64_t source_pid,
    uint64_t target_pid,
    uint64_t detail
) {
    if (!initialized || type < TRACE_TIMER_INTERRUPT ||
        type > TRACE_FILE_WRITE) {
        return false;
    }
    uint64_t interrupt_flags = preserve_and_disable_interrupts();
    if (!initialized) {
        restore_interrupts(interrupt_flags);
        return false;
    }
    events[next_event] = (struct trace_event) {
        .sequence = next_sequence++,
        .tick = tick,
        .source_pid = source_pid,
        .target_pid = target_pid,
        .detail = detail,
        .type = type
    };
    next_event = (next_event + 1) % EXECOS_TRACE_CAPACITY;
    if (event_count < EXECOS_TRACE_CAPACITY) {
        event_count++;
    }
    restore_interrupts(interrupt_flags);
    return true;
}

size_t trace_count(void) {
    return event_count;
}

bool trace_get(size_t index, struct trace_event *event) {
    if (!event) {
        return false;
    }
    uint64_t interrupt_flags = preserve_and_disable_interrupts();
    if (!initialized || index >= event_count) {
        restore_interrupts(interrupt_flags);
        return false;
    }
    size_t oldest_event =
        (next_event + EXECOS_TRACE_CAPACITY - event_count) %
        EXECOS_TRACE_CAPACITY;
    *event = events[(oldest_event + index) % EXECOS_TRACE_CAPACITY];
    restore_interrupts(interrupt_flags);
    return true;
}
