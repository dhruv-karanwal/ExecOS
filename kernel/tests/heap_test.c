#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include "memory/heap.h"

#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 1; \
    } \
} while (0)

struct test_page {
    struct test_page *next;
    uint8_t memory[EXECOS_HEAP_PAGE_SIZE] __attribute__((aligned(4096)));
};

static struct test_page test_pages[4];
static size_t pages_requested;

static void *request_test_page(void *context) {
    (void)context;
    if (pages_requested >= sizeof(test_pages) / sizeof(test_pages[0])) {
        return NULL;
    }
    return test_pages[pages_requested++].memory;
}

int main(void) {
    CHECK(!heap_initialize(NULL, NULL));
    CHECK(heap_initialize(request_test_page, NULL));
    CHECK(!heap_initialize(request_test_page, NULL));
    CHECK(heap_allocate(0) == NULL);
    CHECK(heap_free(NULL) == false);

    uint8_t *first = heap_allocate(33);
    uint8_t *second = heap_allocate(128);
    CHECK(first != NULL && second != NULL);
    CHECK(((uintptr_t)first & 15U) == 0);
    CHECK(((uintptr_t)second & 15U) == 0);
    for (size_t index = 0; index < 33; index++) {
        first[index] = (uint8_t)(index + 1);
    }
    for (size_t index = 0; index < 128; index++) {
        second[index] = (uint8_t)(255 - index);
    }
    for (size_t index = 0; index < 33; index++) {
        CHECK(first[index] == (uint8_t)(index + 1));
    }
    for (size_t index = 0; index < 128; index++) {
        CHECK(second[index] == (uint8_t)(255 - index));
    }

    struct heap_statistics statistics = heap_get_statistics();
    CHECK(statistics.page_count == 1);
    CHECK(statistics.allocated_blocks == 2);
    CHECK(statistics.used_bytes == 176);
    CHECK(statistics.total_bytes == statistics.free_bytes + statistics.used_bytes);
    CHECK(heap_free(first));
    CHECK(!heap_free(first));
    CHECK(heap_free(second));
    statistics = heap_get_statistics();
    CHECK(statistics.allocated_blocks == 0);
    CHECK(statistics.used_bytes == 0);
    CHECK(statistics.free_bytes == statistics.total_bytes);

    uint8_t *coalesced = heap_allocate(3000);
    CHECK(coalesced != NULL);
    CHECK(heap_get_statistics().page_count == 1);
    CHECK(heap_free(coalesced));
    CHECK(heap_allocate(EXECOS_HEAP_PAGE_SIZE) == NULL);

    puts("Kernel heap allocator tests passed.");
    return 0;
}
