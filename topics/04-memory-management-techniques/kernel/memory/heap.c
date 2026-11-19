#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "memory/heap.h"

#define HEAP_ALIGNMENT 16
#define HEAP_PAGE_MAGIC UINT64_C(0x455845434f535047)
#define HEAP_BLOCK_MAGIC UINT64_C(0x455845434f53424c)

struct heap_block;

struct heap_page {
    uint64_t magic;
    struct heap_page *next;
    struct heap_block *first_block;
};

struct heap_block {
    uint64_t magic;
    size_t size;
    struct heap_block *next;
    struct heap_page *page;
    bool allocated;
    uint64_t reserved;
};

static heap_page_request_t page_request;
static void *page_request_context;
static struct heap_page *heap_pages;
static struct heap_statistics statistics;
static bool initialized;

static size_t align_size(size_t size) {
    if (size > SIZE_MAX - (HEAP_ALIGNMENT - 1)) {
        return 0;
    }
    return (size + HEAP_ALIGNMENT - 1) & ~(HEAP_ALIGNMENT - 1);
}

static bool add_page(void) {
    void *memory = page_request(page_request_context);
    if (!memory || ((uintptr_t)memory & (HEAP_ALIGNMENT - 1)) != 0) {
        return false;
    }

    uintptr_t block_address = (uintptr_t)memory + sizeof(struct heap_page);
    block_address = (block_address + HEAP_ALIGNMENT - 1) &
        ~(uintptr_t)(HEAP_ALIGNMENT - 1);
    uintptr_t page_end = (uintptr_t)memory + EXECOS_HEAP_PAGE_SIZE;
    if (block_address > page_end ||
        sizeof(struct heap_block) > page_end - block_address) {
        return false;
    }

    struct heap_page *page = memory;
    struct heap_block *block = (struct heap_block *)block_address;
    size_t payload_size = (size_t)(page_end - block_address) - sizeof(*block);
    payload_size &= ~(size_t)(HEAP_ALIGNMENT - 1);
    if (payload_size == 0) {
        return false;
    }

    *page = (struct heap_page) {
        .magic = HEAP_PAGE_MAGIC,
        .next = heap_pages,
        .first_block = block
    };
    *block = (struct heap_block) {
        .magic = HEAP_BLOCK_MAGIC,
        .size = payload_size,
        .next = NULL,
        .page = page,
        .allocated = false
    };
    heap_pages = page;
    statistics.page_count++;
    statistics.total_bytes += payload_size;
    statistics.free_bytes += payload_size;
    return true;
}

bool heap_initialize(heap_page_request_t request_page, void *context) {
    if (initialized || !request_page) {
        return false;
    }
    page_request = request_page;
    page_request_context = context;
    heap_pages = NULL;
    statistics = (struct heap_statistics){0};
    initialized = true;
    return true;
}

void *heap_allocate(size_t size) {
    if (!initialized || size == 0) {
        return NULL;
    }
    size_t requested_size = align_size(size);
    uintptr_t block_start = (sizeof(struct heap_page) + HEAP_ALIGNMENT - 1) &
        ~(uintptr_t)(HEAP_ALIGNMENT - 1);
    size_t maximum_size =
        (EXECOS_HEAP_PAGE_SIZE - block_start - sizeof(struct heap_block)) &
        ~(size_t)(HEAP_ALIGNMENT - 1);
    if (requested_size == 0 ||
        requested_size > maximum_size) {
        return NULL;
    }

    for (;;) {
        for (struct heap_page *page = heap_pages; page; page = page->next) {
            if (page->magic != HEAP_PAGE_MAGIC) {
                return NULL;
            }
            for (struct heap_block *block = page->first_block; block; block = block->next) {
                if (block->magic != HEAP_BLOCK_MAGIC || block->page != page) {
                    return NULL;
                }
                if (block->allocated || block->size < requested_size) {
                    continue;
                }

                size_t remaining = block->size - requested_size;
                if (remaining >= sizeof(struct heap_block) + HEAP_ALIGNMENT) {
                    struct heap_block *split = (struct heap_block *)(
                        (uint8_t *)(block + 1) + requested_size
                    );
                    *split = (struct heap_block) {
                        .magic = HEAP_BLOCK_MAGIC,
                        .size = remaining - sizeof(*split),
                        .next = block->next,
                        .page = page,
                        .allocated = false
                    };
                    block->next = split;
                    block->size = requested_size;
                    statistics.total_bytes -= sizeof(*split);
                    statistics.free_bytes -= sizeof(*split);
                }
                block->allocated = true;
                statistics.used_bytes += block->size;
                statistics.free_bytes -= block->size;
                statistics.allocated_blocks++;
                return block + 1;
            }
        }
        if (!add_page()) {
            return NULL;
        }
    }
}

bool heap_free(void *allocation) {
    if (!initialized || !allocation) {
        return false;
    }

    struct heap_page *page = heap_pages;
    struct heap_block *owner = NULL;
    while (page) {
        uintptr_t start = (uintptr_t)page;
        uintptr_t end = start + EXECOS_HEAP_PAGE_SIZE;
        if (page->magic != HEAP_PAGE_MAGIC) {
            return false;
        }
        if ((uintptr_t)allocation > start && (uintptr_t)allocation < end) {
            owner = (struct heap_block *)allocation - 1;
            break;
        }
        page = page->next;
    }
    if (!owner || owner->magic != HEAP_BLOCK_MAGIC ||
        owner->page != page || !owner->allocated ||
        (void *)(owner + 1) != allocation) {
        return false;
    }

    owner->allocated = false;
    statistics.used_bytes -= owner->size;
    statistics.free_bytes += owner->size;
    statistics.allocated_blocks--;

    struct heap_block *block = page->first_block;
    while (block) {
        if (block->magic != HEAP_BLOCK_MAGIC || block->page != page) {
            return false;
        }
        if (!block->allocated && block->next && !block->next->allocated) {
            struct heap_block *next = block->next;
            block->size += sizeof(*next) + next->size;
            block->next = next->next;
            statistics.total_bytes += sizeof(*next);
            statistics.free_bytes += sizeof(*next);
            continue;
        }
        block = block->next;
    }
    return true;
}

struct heap_statistics heap_get_statistics(void) {
    return statistics;
}
