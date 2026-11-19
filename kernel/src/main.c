#include <stdbool.h>
#include <stdint.h>
#include <limine.h>

#include "arch/x86_64/idt.h"
#include "arch/x86_64/pic.h"
#include "arch/x86_64/serial.h"
#include "filesystem/filesystem.h"
#include "memory/heap.h"
#include "memory/pmm.h"
#include "process/process.h"
#include "scheduler/scheduler.h"
#include "shell/shell.h"
#include "tracing/trace.h"

#define EXECOS_MAX_MEMORY_MAP_ENTRIES 256

__attribute__((used, section(".limine_requests")))
static volatile uint64_t limine_base_revision[] = LIMINE_BASE_REVISION(6);

__attribute__((used, section(".limine_requests")))
static volatile struct limine_hhdm_request limine_hhdm_request = {
    .id = LIMINE_HHDM_REQUEST_ID,
    .revision = 0,
    .response = NULL
};

__attribute__((used, section(".limine_requests")))
static volatile struct limine_memmap_request limine_memmap_request = {
    .id = LIMINE_MEMMAP_REQUEST_ID,
    .revision = 0,
    .response = NULL
};

__attribute__((used, section(".limine_requests_start")))
static volatile uint64_t limine_requests_start_marker[] = LIMINE_REQUESTS_START_MARKER;

__attribute__((used, section(".limine_requests_end")))
static volatile uint64_t limine_requests_end_marker[] = LIMINE_REQUESTS_END_MARKER;

static struct pmm_region memory_regions[EXECOS_MAX_MEMORY_MAP_ENTRIES];
static volatile uint64_t scheduler_test_work[2];
static uint64_t physical_memory_offset;

static void *request_heap_page(void *context) {
    uint64_t frame = pmm_allocate_frame();
    uint64_t hhdm_offset = (uint64_t)(uintptr_t)context;
    if (frame == 0 || hhdm_offset > UINTPTR_MAX - frame) {
        if (frame != 0) {
            pmm_free_frame(frame);
        }
        return NULL;
    }
    return (void *)(uintptr_t)(hhdm_offset + frame);
}

static void scheduler_test_worker(void *argument) {
    size_t worker_index = (size_t)(uintptr_t)argument;
    for (;;) {
        scheduler_test_work[worker_index]++;
    }
}

static bool filesystem_self_test(void) {
    static const char expected[] = "ExecOS RAM filesystem";
    char actual[sizeof(expected)] = {0};
    if (!fs_initialize() ||
        !fs_mkdir("/boot") ||
        !fs_create_file("/boot/selftest.txt")) {
        return false;
    }
    int descriptor = fs_open("/boot/selftest.txt", FS_OPEN_WRITE);
    if (descriptor < 0 ||
        fs_write(descriptor, expected, sizeof(expected) - 1) !=
            (int64_t)(sizeof(expected) - 1) ||
        !fs_close(descriptor)) {
        return false;
    }
    descriptor = fs_open("/boot/selftest.txt", FS_OPEN_READ);
    if (descriptor < 0 ||
        fs_read(descriptor, actual, sizeof(actual) - 1) !=
            (int64_t)(sizeof(expected) - 1) ||
        actual[sizeof(expected) - 1] != '\0' ||
        !fs_close(descriptor)) {
        return false;
    }
    for (size_t index = 0; index < sizeof(expected); index++) {
        if (actual[index] != expected[index]) {
            return false;
        }
    }
    return fs_remove("/boot/selftest.txt") && fs_remove("/boot");
}

static bool shell_self_test(void) {
    char create_directory[] = "mkdir /shell-test";
    char write_file[] = "write /shell-test/message.txt kernel shell";
    char show_file[] = "cat /shell-test/message.txt";
    char rename_file[] = "mv /shell-test/message.txt /shell-test/renamed.txt";
    char list_directory[] = "ls /shell-test";
    char remove_file[] = "rm /shell-test/renamed.txt";
    char remove_directory[] = "rm /shell-test";
    char terminate_worker[] = "kill 2";
    if (!shell_execute_line(create_directory) ||
        !shell_execute_line(write_file) ||
        !shell_execute_line(show_file) ||
        !shell_execute_line(rename_file) ||
        !shell_execute_line(list_directory)) {
        return false;
    }
    int descriptor = fs_open("/shell-test/renamed.txt", FS_OPEN_READ);
    char contents[13] = {0};
    bool file_is_correct =
        descriptor > 0 &&
        fs_read(descriptor, contents, sizeof(contents) - 1) == 12 &&
        contents[0] == 'k' && contents[1] == 'e' && contents[2] == 'r' &&
        contents[3] == 'n' && contents[4] == 'e' && contents[5] == 'l' &&
        contents[6] == ' ' && contents[7] == 's' && contents[8] == 'h' &&
        contents[9] == 'e' && contents[10] == 'l' && contents[11] == 'l' &&
        contents[12] == '\0';
    if (descriptor > 0 && !fs_close(descriptor)) {
        file_is_correct = false;
    }
    return file_is_correct &&
        shell_execute_line(remove_file) &&
        shell_execute_line(remove_directory) &&
        shell_execute_line(terminate_worker) &&
        process_get(1)->state == PROCESS_TERMINATED;
}

static void halt_cpu(void) {
    for (;;) {
        __asm__ volatile ("cli; hlt");
    }
}

static bool add_u64(uint64_t left, uint64_t right, uint64_t *result) {
    if (right > UINT64_MAX - left) {
        return false;
    }
    *result = left + right;
    return true;
}

static void write_memory_report(
    uint64_t map_entries,
    uint64_t usable_bytes,
    uint64_t hhdm_offset,
    uint64_t storage_physical,
    struct pmm_statistics statistics
) {
    serial_write_text("Limine memory map entries: ");
    serial_write_u64(map_entries);
    serial_write_line("");
    serial_write_text("HHDM physical offset: ");
    serial_write_hex(hhdm_offset);
    serial_write_line("");
    serial_write_text("Usable physical memory: ");
    serial_write_u64(usable_bytes / (1024 * 1024));
    serial_write_line(" MiB");
    serial_write_text("Frame allocator metadata physical address: ");
    serial_write_hex(storage_physical);
    serial_write_line("");
    serial_write_text("Managed physical frames: ");
    serial_write_u64(statistics.managed_frames);
    serial_write_line("");
    serial_write_text("Free physical frames: ");
    serial_write_u64(statistics.free_frames);
    serial_write_line("");
}

static bool initialize_physical_memory(void) {
    struct limine_memmap_response *memory_map = limine_memmap_request.response;
    struct limine_hhdm_response *hhdm = limine_hhdm_request.response;
    if (!memory_map || !memory_map->entries || !hhdm ||
        memory_map->entry_count == 0 ||
        memory_map->entry_count > EXECOS_MAX_MEMORY_MAP_ENTRIES) {
        serial_write_line("ExecOS: missing or unsupported Limine memory information.");
        return false;
    }

    uint64_t usable_bytes = 0;
    for (uint64_t index = 0; index < memory_map->entry_count; index++) {
        struct limine_memmap_entry *entry = memory_map->entries[index];
        uint64_t end;
        if (!entry || !add_u64(entry->base, entry->length, &end)) {
            serial_write_line("ExecOS: invalid Limine memory-map entry.");
            return false;
        }
        memory_regions[index] = (struct pmm_region) {
            .base = entry->base,
            .length = entry->length,
            .type = entry->type
        };
        if (entry->type == LIMINE_MEMMAP_USABLE &&
            !add_u64(usable_bytes, entry->length, &usable_bytes)) {
            serial_write_line("ExecOS: usable-memory total overflowed.");
            return false;
        }
    }

    size_t required_storage = pmm_required_storage(
        memory_regions, (size_t)memory_map->entry_count
    );
    if (required_storage == 0 ||
        required_storage > UINT64_MAX - (PMM_PAGE_SIZE - 1)) {
        serial_write_line("ExecOS: could not size physical frame allocator.");
        return false;
    }
    uint64_t storage_bytes =
        ((uint64_t)required_storage + PMM_PAGE_SIZE - 1) & ~(PMM_PAGE_SIZE - 1);
    uint64_t storage_physical;
    if (!pmm_find_storage_region(
            memory_regions,
            (size_t)memory_map->entry_count,
            (size_t)storage_bytes,
            PMM_MIN_ALLOCATABLE_ADDRESS,
            &storage_physical)) {
        serial_write_line("ExecOS: no usable memory range can hold allocator metadata.");
        return false;
    }

    uint64_t storage_virtual;
    if (!add_u64(hhdm->offset, storage_physical, &storage_virtual) ||
        storage_virtual > UINTPTR_MAX ||
        storage_bytes > UINTPTR_MAX - (uintptr_t)storage_virtual) {
        serial_write_line("ExecOS: HHDM address for allocator metadata is invalid.");
        return false;
    }

    if (!pmm_initialize(
            memory_regions,
            (size_t)memory_map->entry_count,
            (void *)(uintptr_t)storage_virtual,
            (size_t)storage_bytes,
            storage_physical)) {
        serial_write_line("ExecOS: physical frame allocator initialization failed.");
        return false;
    }
    physical_memory_offset = hhdm->offset;

    uint64_t test_frame = pmm_allocate_frame();
    if (test_frame < PMM_MIN_ALLOCATABLE_ADDRESS ||
        !pmm_free_frame(test_frame)) {
        serial_write_line("ExecOS: physical frame allocator self-test failed.");
        return false;
    }
    serial_write_line("ExecOS: physical frame allocator allocate/free self-test passed.");
    write_memory_report(
        memory_map->entry_count,
        usable_bytes,
        hhdm->offset,
        storage_physical,
        pmm_get_statistics()
    );
    return true;
}

void kmain(void) {
    serial_initialize();
    serial_write_line("ExecOS: kernel entry reached.");

    if (!LIMINE_BASE_REVISION_SUPPORTED(limine_base_revision)) {
        serial_write_line("ExecOS: unsupported Limine base revision.");
        halt_cpu();
    }

    serial_write_line("ExecOS kernel booted");
    if (!initialize_physical_memory()) {
        halt_cpu();
    }
    serial_write_line("ExecOS: physical frame allocator initialized.");
    if (!heap_initialize(
            request_heap_page,
            (void *)(uintptr_t)physical_memory_offset)) {
        serial_write_line("ExecOS: kernel heap initialization failed.");
        halt_cpu();
    }
    uint8_t *heap_test_a = heap_allocate(73);
    uint8_t *heap_test_b = heap_allocate(129);
    if (!heap_test_a || !heap_test_b ||
        ((uintptr_t)heap_test_a & 15U) != 0 ||
        ((uintptr_t)heap_test_b & 15U) != 0) {
        serial_write_line("ExecOS: kernel heap allocation self-test failed.");
        halt_cpu();
    }
    heap_test_a[0] = 0xa5;
    heap_test_b[0] = 0x5a;
    bool heap_test_passed =
        heap_test_a[0] == 0xa5 &&
        heap_test_b[0] == 0x5a &&
        heap_free(heap_test_a) &&
        heap_free(heap_test_b) &&
        !heap_free(heap_test_a) &&
        heap_get_statistics().used_bytes == 0;
    if (!heap_test_passed) {
        serial_write_line("ExecOS: kernel heap free/coalesce self-test failed.");
        halt_cpu();
    }
    serial_write_line("ExecOS: page-backed kernel heap self-test passed.");
    if (!trace_initialize()) {
        serial_write_line("ExecOS: execution trace initialization failed.");
        halt_cpu();
    }
    if (!filesystem_self_test()) {
        serial_write_line("ExecOS: in-memory filesystem self-test failed.");
        halt_cpu();
    }
    serial_write_line("ExecOS: in-memory filesystem self-test passed.");
    if (!idt_initialize()) {
        serial_write_line("ExecOS: IDT initialization failed.");
        halt_cpu();
    }
    serial_write_line("ExecOS: IDT installed.");
    __asm__ volatile ("int3");
    serial_write_line("ExecOS: breakpoint exception self-test passed.");
    if (!process_initialize()) {
        serial_write_line("ExecOS: process subsystem initialization failed.");
        halt_cpu();
    }
    if (!scheduler_initialize()) {
        serial_write_line("ExecOS: scheduler initialization failed.");
        halt_cpu();
    }
    uint64_t first_worker = process_create_kernel_thread(
        "worker-a", scheduler_test_worker, (void *)(uintptr_t)0, 3
    );
    uint64_t second_worker = process_create_kernel_thread(
        "worker-b", scheduler_test_worker, (void *)(uintptr_t)1, 3
    );
    if (first_worker == 0 || second_worker == 0) {
        serial_write_line("ExecOS: kernel worker creation failed.");
        halt_cpu();
    }
    serial_write_text("ExecOS: process and scheduler initialized; worker PIDs ");
    serial_write_u64(first_worker);
    serial_write_text(", ");
    serial_write_u64(second_worker);
    serial_write_line(".");
    pic_initialize();
    if (!pit_timer_initialize(100)) {
        serial_write_line("ExecOS: PIT timer initialization failed.");
        halt_cpu();
    }
    pic_unmask_irq(0);
    serial_write_line("ExecOS: PIT configured at 100 Hz; waiting for timer IRQs.");
    while (pit_timer_ticks() < 30) {
        __asm__ volatile ("sti; hlt" : : : "memory");
    }
    serial_write_text("ExecOS: timer IRQs received: ");
    serial_write_u64(pit_timer_ticks());
    serial_write_line("");
    serial_write_line("ExecOS: PIT timer interrupt self-test passed.");
    size_t context_switches = 0;
    size_t timer_events = 0;
    for (size_t index = 0; index < trace_count(); index++) {
        struct trace_event event;
        if (!trace_get(index, &event)) {
            serial_write_line("ExecOS: execution trace read failed.");
            halt_cpu();
        }
        if (event.type == TRACE_CONTEXT_SWITCH) {
            context_switches++;
        } else if (event.type == TRACE_TIMER_INTERRUPT) {
            timer_events++;
        }
    }
    serial_write_text("ExecOS: execution trace events ");
    serial_write_u64(trace_count());
    serial_write_text(", timer IRQs ");
    serial_write_u64(timer_events);
    serial_write_text(", context switches ");
    serial_write_u64(context_switches);
    serial_write_line(".");
    if (timer_events < 30 || context_switches < 20) {
        serial_write_line("ExecOS: execution trace self-test failed.");
        halt_cpu();
    }
    serial_write_line("ExecOS: execution trace self-test passed.");
    if (scheduler_test_work[0] == 0 || scheduler_test_work[1] == 0 ||
        process_get(1)->cpu_ticks == 0 || process_get(2)->cpu_ticks == 0) {
        serial_write_line("ExecOS: round-robin kernel thread self-test failed.");
        halt_cpu();
    }
    serial_write_text("ExecOS: round-robin ran kernel workers ");
    serial_write_u64(scheduler_test_work[0]);
    serial_write_text(" and ");
    serial_write_u64(scheduler_test_work[1]);
    serial_write_line(" iterations.");
    serial_write_text("ExecOS: worker CPU ticks ");
    serial_write_u64(process_get(1)->cpu_ticks);
    serial_write_text(" and ");
    serial_write_u64(process_get(2)->cpu_ticks);
    serial_write_line(".");
    serial_write_line("ExecOS: kernel process/scheduler self-test passed.");
    if (!shell_self_test()) {
        serial_write_line("ExecOS: kernel shell command self-test failed.");
        halt_cpu();
    }
    serial_write_line("ExecOS: kernel shell command self-test passed.");
    shell_run();
}
