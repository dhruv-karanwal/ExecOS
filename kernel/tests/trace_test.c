#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

#include "tracing/trace.h"

#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 1; \
    } \
} while (0)

int main(void) {
    CHECK(!trace_record(TRACE_TIMER_INTERRUPT, 0, 0, 0, 0));
    CHECK(trace_initialize());
    CHECK(!trace_initialize());
    CHECK(!trace_record((enum trace_event_type)99, 0, 0, 0, 0));

    for (uint64_t sequence = 1; sequence <= EXECOS_TRACE_CAPACITY + 5; sequence++) {
        CHECK(trace_record(
            TRACE_CONTEXT_SWITCH,
            sequence * 10,
            sequence,
            sequence + 1,
            sequence * 2
        ));
    }
    CHECK(trace_count() == EXECOS_TRACE_CAPACITY);
    struct trace_event event;
    CHECK(!trace_get(EXECOS_TRACE_CAPACITY, &event));
    CHECK(!trace_get(0, NULL));
    CHECK(trace_get(0, &event));
    CHECK(event.sequence == 6);
    CHECK(event.tick == 60);
    CHECK(event.source_pid == 6);
    CHECK(event.target_pid == 7);
    CHECK(event.detail == 12);
    CHECK(event.type == TRACE_CONTEXT_SWITCH);
    CHECK(trace_get(EXECOS_TRACE_CAPACITY - 1, &event));
    CHECK(event.sequence == EXECOS_TRACE_CAPACITY + 5);

    puts("Kernel execution trace tests passed.");
    return 0;
}
