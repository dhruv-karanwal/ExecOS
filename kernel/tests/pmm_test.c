#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include "memory/pmm.h"

#define MIB (1024ULL * 1024)
#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 1; \
    } \
} while (0)

int main(void) {
    const struct pmm_region regions[] = {
        { .base = 0, .length = MIB, .type = 1 },
        { .base = MIB, .length = 7 * MIB, .type = PMM_REGION_USABLE },
        { .base = 8 * MIB, .length = 8 * MIB, .type = 6 },
        { .base = 16 * MIB, .length = 16 * MIB, .type = PMM_REGION_USABLE },
        { .base = 40 * MIB, .length = PMM_PAGE_SIZE, .type = 4 },
    };
    size_t required = pmm_required_storage(regions, sizeof(regions) / sizeof(regions[0]));
    CHECK(required > 0);
    uint64_t storage_address = 0;
    CHECK(pmm_find_storage_region(
        regions,
        sizeof(regions) / sizeof(regions[0]),
        required,
        PMM_MIN_ALLOCATABLE_ADDRESS,
        &storage_address
    ));
    CHECK(storage_address == MIB);

    size_t storage_size = (required + PMM_PAGE_SIZE - 1) & ~(PMM_PAGE_SIZE - 1);
    void *storage = calloc(1, storage_size);
    CHECK(storage != NULL);
    CHECK(!pmm_initialize(
        regions,
        sizeof(regions) / sizeof(regions[0]),
        storage,
        required - 1,
        storage_address
    ));
    CHECK(pmm_initialize(
        regions,
        sizeof(regions) / sizeof(regions[0]),
        storage,
        storage_size,
        storage_address
    ));

    struct pmm_statistics statistics = pmm_get_statistics();
    CHECK(statistics.managed_frames == 5887);
    CHECK(statistics.free_frames == 5887);
    CHECK(statistics.allocated_frames == 0);
    CHECK(!pmm_free_frame(0));
    CHECK(!pmm_free_frame(storage_address));
    CHECK(!pmm_free_frame(8 * MIB));

    uint64_t frame = pmm_allocate_frame();
    CHECK(frame == MIB + PMM_PAGE_SIZE);
    CHECK(pmm_get_statistics().free_frames == 5886);
    CHECK(!pmm_free_frame(frame + 1));
    CHECK(pmm_free_frame(frame));
    CHECK(!pmm_free_frame(frame));
    CHECK(pmm_get_statistics().free_frames == 5887);

    size_t frame_total = (size_t)pmm_get_statistics().managed_frames;
    uint64_t *allocated = calloc(frame_total, sizeof(*allocated));
    CHECK(allocated != NULL);
    allocated[0] = pmm_allocate_frame();
    CHECK(allocated[0] == frame);
    for (size_t index = 1; index < frame_total; index++) {
        uint64_t address = pmm_allocate_frame();
        CHECK(address != 0);
        CHECK(address < 8 * MIB || (address >= 16 * MIB && address < 32 * MIB));
        CHECK(address != storage_address);
        allocated[index] = address;
    }
    CHECK(pmm_get_statistics().free_frames == 0);
    CHECK(pmm_allocate_frame() == 0);
    for (size_t index = 0; index < frame_total; index++) {
        CHECK(pmm_free_frame(allocated[index]));
    }
    CHECK(pmm_get_statistics().free_frames == frame_total);
    free(allocated);

    const struct pmm_region invalid_region[] = {
        { .base = UINT64_MAX - 1023, .length = 2048, .type = PMM_REGION_USABLE },
    };
    CHECK(pmm_required_storage(invalid_region, 1) == 0);

    free(storage);
    puts("Physical frame allocator tests passed.");
    return 0;
}
