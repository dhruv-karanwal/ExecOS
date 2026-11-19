#ifndef EXECOS_MEMORY_HEAP_H
#define EXECOS_MEMORY_HEAP_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define EXECOS_HEAP_PAGE_SIZE 4096

typedef void *(*heap_page_request_t)(void *context);

struct heap_statistics {
    size_t page_count;
    size_t allocated_blocks;
    size_t used_bytes;
    size_t free_bytes;
    size_t total_bytes;
};

bool heap_initialize(heap_page_request_t request_page, void *context);
void *heap_allocate(size_t size);
bool heap_free(void *allocation);
struct heap_statistics heap_get_statistics(void);

#endif
