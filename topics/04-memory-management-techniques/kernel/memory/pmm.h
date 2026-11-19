#ifndef EXECOS_PMM_H
#define EXECOS_PMM_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define PMM_PAGE_SIZE 4096ULL
#define PMM_REGION_USABLE 0ULL
#define PMM_MIN_ALLOCATABLE_ADDRESS 0x100000ULL

struct pmm_region {
    uint64_t base;
    uint64_t length;
    uint64_t type;
};

struct pmm_statistics {
    uint64_t managed_frames;
    uint64_t free_frames;
    uint64_t reserved_frames;
    uint64_t allocated_frames;
};

size_t pmm_required_storage(const struct pmm_region *regions, size_t region_count);
bool pmm_find_storage_region(
    const struct pmm_region *regions,
    size_t region_count,
    size_t storage_size,
    uint64_t minimum_address,
    uint64_t *storage_physical_address
);
bool pmm_initialize(
    const struct pmm_region *regions,
    size_t region_count,
    void *storage,
    size_t storage_size,
    uint64_t storage_physical_address
);
uint64_t pmm_allocate_frame(void);
bool pmm_free_frame(uint64_t physical_address);
struct pmm_statistics pmm_get_statistics(void);

#endif
