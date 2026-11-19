#include "memory/pmm.h"

#define PMM_BITS_PER_BYTE 8U

static uint8_t *used_bitmap;
static uint8_t *permanent_bitmap;
static uint64_t frame_count;
static uint64_t free_frame_count;
static uint64_t managed_frame_count;
static uint64_t next_search_frame;

static bool checked_range_end(uint64_t base, uint64_t length, uint64_t *end) {
    if (length > UINT64_MAX - base) {
        return false;
    }
    *end = base + length;
    return true;
}

static uint64_t align_up_page(uint64_t address) {
    if (address > UINT64_MAX - (PMM_PAGE_SIZE - 1)) {
        return UINT64_MAX;
    }
    return (address + PMM_PAGE_SIZE - 1) & ~(PMM_PAGE_SIZE - 1);
}

static size_t bitmap_size_for_frames(uint64_t frames) {
    uint64_t bytes = frames / PMM_BITS_PER_BYTE;
    if (frames % PMM_BITS_PER_BYTE) {
        bytes++;
    }
    if (bytes > SIZE_MAX / 2) {
        return 0;
    }
    return (size_t)bytes * 2;
}

static uint64_t maximum_frame_count(const struct pmm_region *regions, size_t count) {
    uint64_t maximum_end = 0;
    for (size_t index = 0; index < count; index++) {
        uint64_t end;
        if (!checked_range_end(regions[index].base, regions[index].length, &end)) {
            return 0;
        }
        if (end > maximum_end) {
            maximum_end = end;
        }
    }
    if (maximum_end > UINT64_MAX - (PMM_PAGE_SIZE - 1)) {
        return 0;
    }
    return (maximum_end + PMM_PAGE_SIZE - 1) / PMM_PAGE_SIZE;
}

size_t pmm_required_storage(const struct pmm_region *regions, size_t region_count) {
    if (!regions || region_count == 0) {
        return 0;
    }
    return bitmap_size_for_frames(maximum_frame_count(regions, region_count));
}

bool pmm_find_storage_region(
    const struct pmm_region *regions,
    size_t region_count,
    size_t storage_size,
    uint64_t minimum_address,
    uint64_t *storage_physical_address
) {
    if (!regions || region_count == 0 || storage_size == 0 || !storage_physical_address) {
        return false;
    }
    if (storage_size > UINT64_MAX - (PMM_PAGE_SIZE - 1)) {
        return false;
    }
    uint64_t needed = align_up_page((uint64_t)storage_size);
    uint64_t minimum = align_up_page(minimum_address);
    if (needed == UINT64_MAX || minimum == UINT64_MAX) {
        return false;
    }

    for (size_t index = 0; index < region_count; index++) {
        if (regions[index].type != PMM_REGION_USABLE) {
            continue;
        }
        uint64_t end;
        if (!checked_range_end(regions[index].base, regions[index].length, &end)) {
            continue;
        }
        uint64_t start = align_up_page(regions[index].base);
        if (start < minimum) {
            start = minimum;
        }
        uint64_t usable_end = end & ~(PMM_PAGE_SIZE - 1);
        if (start <= usable_end && needed <= usable_end - start) {
            *storage_physical_address = start;
            return true;
        }
    }
    return false;
}

static bool bitmap_get(const uint8_t *bitmap, uint64_t frame) {
    return (bitmap[frame / PMM_BITS_PER_BYTE] & (uint8_t)(1U << (frame % PMM_BITS_PER_BYTE))) != 0;
}

static void bitmap_set(uint8_t *bitmap, uint64_t frame) {
    bitmap[frame / PMM_BITS_PER_BYTE] |= (uint8_t)(1U << (frame % PMM_BITS_PER_BYTE));
}

static void bitmap_clear(uint8_t *bitmap, uint64_t frame) {
    bitmap[frame / PMM_BITS_PER_BYTE] &= (uint8_t)~(1U << (frame % PMM_BITS_PER_BYTE));
}

bool pmm_initialize(
    const struct pmm_region *regions,
    size_t region_count,
    void *storage,
    size_t storage_size,
    uint64_t storage_physical_address
) {
    used_bitmap = NULL;
    permanent_bitmap = NULL;
    frame_count = 0;
    free_frame_count = 0;
    managed_frame_count = 0;
    next_search_frame = 0;
    if (!regions || region_count == 0 || !storage ||
        storage_physical_address % PMM_PAGE_SIZE != 0) {
        return false;
    }
    uint64_t next_frame_count = maximum_frame_count(regions, region_count);
    size_t required_storage = bitmap_size_for_frames(next_frame_count);
    if (next_frame_count == 0 || required_storage == 0 || storage_size < required_storage) {
        return false;
    }

    uint64_t storage_end;
    if (!checked_range_end(storage_physical_address, storage_size, &storage_end)) {
        return false;
    }
    bool storage_is_usable = false;
    for (size_t index = 0; index < region_count; index++) {
        uint64_t end;
        if (regions[index].type == PMM_REGION_USABLE &&
            checked_range_end(regions[index].base, regions[index].length, &end) &&
            storage_physical_address >= regions[index].base && storage_end <= end) {
            storage_is_usable = true;
            break;
        }
    }
    if (!storage_is_usable) {
        return false;
    }

    uint64_t storage_first = storage_physical_address / PMM_PAGE_SIZE;
    uint64_t storage_last = storage_end / PMM_PAGE_SIZE;
    if (storage_end % PMM_PAGE_SIZE) {
        storage_last++;
    }
    if (storage_first < PMM_MIN_ALLOCATABLE_ADDRESS / PMM_PAGE_SIZE ||
        storage_last > next_frame_count) {
        return false;
    }
    for (uint64_t frame = storage_first; frame < storage_last; frame++) {
        uint64_t address = frame * PMM_PAGE_SIZE;
        bool frame_is_usable = false;
        for (size_t index = 0; index < region_count; index++) {
            uint64_t end;
            if (regions[index].type == PMM_REGION_USABLE &&
                checked_range_end(regions[index].base, regions[index].length, &end) &&
                address >= regions[index].base && address + PMM_PAGE_SIZE <= end) {
                frame_is_usable = true;
                break;
            }
        }
        if (!frame_is_usable) {
            return false;
        }
    }

    size_t bitmap_bytes = required_storage / 2;
    used_bitmap = storage;
    permanent_bitmap = used_bitmap + bitmap_bytes;
    frame_count = next_frame_count;
    free_frame_count = 0;
    managed_frame_count = 0;

    for (size_t index = 0; index < required_storage; index++) {
        ((uint8_t *)storage)[index] = 0xff;
    }

    uint64_t permanent_start = (PMM_MIN_ALLOCATABLE_ADDRESS + PMM_PAGE_SIZE - 1) / PMM_PAGE_SIZE;
    for (size_t index = 0; index < region_count; index++) {
        if (regions[index].type != PMM_REGION_USABLE) {
            continue;
        }
        uint64_t end;
        if (!checked_range_end(regions[index].base, regions[index].length, &end)) {
            continue;
        }
        uint64_t aligned_start = align_up_page(regions[index].base);
        if (aligned_start == UINT64_MAX) {
            continue;
        }
        uint64_t first = aligned_start / PMM_PAGE_SIZE;
        uint64_t last = end / PMM_PAGE_SIZE;
        if (first < permanent_start) {
            first = permanent_start;
        }
        if (last > frame_count) {
            last = frame_count;
        }
        for (uint64_t frame = first; frame < last; frame++) {
            bitmap_clear(used_bitmap, frame);
            bitmap_clear(permanent_bitmap, frame);
            managed_frame_count++;
            free_frame_count++;
        }
    }

    for (uint64_t frame = storage_first; frame < storage_last; frame++) {
        bitmap_set(used_bitmap, frame);
        bitmap_set(permanent_bitmap, frame);
        free_frame_count--;
        managed_frame_count--;
    }
    next_search_frame = permanent_start;
    return true;
}

uint64_t pmm_allocate_frame(void) {
    if (!used_bitmap || free_frame_count == 0) {
        return 0;
    }
    for (uint64_t frame = next_search_frame; frame < frame_count; frame++) {
        if (!bitmap_get(used_bitmap, frame)) {
            bitmap_set(used_bitmap, frame);
            free_frame_count--;
            next_search_frame = frame + 1 < frame_count
                ? frame + 1
                : PMM_MIN_ALLOCATABLE_ADDRESS / PMM_PAGE_SIZE;
            return frame * PMM_PAGE_SIZE;
        }
    }
    for (uint64_t frame = PMM_MIN_ALLOCATABLE_ADDRESS / PMM_PAGE_SIZE;
         frame < next_search_frame;
         frame++) {
        if (!bitmap_get(used_bitmap, frame)) {
            bitmap_set(used_bitmap, frame);
            free_frame_count--;
            next_search_frame = frame + 1 < frame_count
                ? frame + 1
                : PMM_MIN_ALLOCATABLE_ADDRESS / PMM_PAGE_SIZE;
            return frame * PMM_PAGE_SIZE;
        }
    }
    return 0;
}

bool pmm_free_frame(uint64_t physical_address) {
    if (!used_bitmap || physical_address % PMM_PAGE_SIZE != 0) {
        return false;
    }
    uint64_t frame = physical_address / PMM_PAGE_SIZE;
    if (frame >= frame_count || bitmap_get(permanent_bitmap, frame) ||
        !bitmap_get(used_bitmap, frame)) {
        return false;
    }
    bitmap_clear(used_bitmap, frame);
    free_frame_count++;
    if (frame < next_search_frame) {
        next_search_frame = frame;
    }
    return true;
}

struct pmm_statistics pmm_get_statistics(void) {
    uint64_t allocated = managed_frame_count - free_frame_count;
    return (struct pmm_statistics) {
        .managed_frames = managed_frame_count,
        .free_frames = free_frame_count,
        .reserved_frames = frame_count - managed_frame_count,
        .allocated_frames = allocated,
    };
}
