#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "filesystem/filesystem.h"
#include "memory/heap.h"
#include "memory/pmm.h"
#include "process/process.h"
#include "shell/shell.h"
#include "tracing/trace.h"

#define OUTPUT_CAPACITY 8192
#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 1; \
    } \
} while (0)

static char output[OUTPUT_CAPACITY];
static size_t output_length;
static uint64_t test_quantum = 1;
static uint64_t terminated_pid;
static struct process test_process = {
    .pid = 42,
    .parent_pid = 1,
    .state = PROCESS_RUNNING,
    .cpu_ticks = 9,
    .name = "shell-test"
};

static void reset_output(void) {
    output_length = 0;
    output[0] = '\0';
}

bool serial_try_read_character(char *character) {
    (void)character;
    return false;
}

void serial_write_text(const char *text) {
    while (*text && output_length + 1 < sizeof(output)) {
        output[output_length++] = *text++;
    }
    output[output_length] = '\0';
}

void serial_write_line(const char *text) {
    serial_write_text(text);
    serial_write_text("\n");
}

void serial_write_u64(uint64_t value) {
    char digits[20];
    size_t count = 0;
    do {
        digits[count++] = (char)('0' + value % 10);
        value /= 10;
    } while (value != 0);
    while (count > 0) {
        char character[2] = {digits[--count], '\0'};
        serial_write_text(character);
    }
}

size_t process_count(void) {
    return 1;
}

struct process *process_get(size_t index) {
    return index == 0 ? &test_process : NULL;
}

bool process_terminate(uint64_t pid, int32_t exit_status) {
    (void)exit_status;
    if (pid != 77) {
        return false;
    }
    terminated_pid = pid;
    return true;
}

struct pmm_statistics pmm_get_statistics(void) {
    return (struct pmm_statistics) {
        .managed_frames = 100,
        .free_frames = 80,
        .allocated_frames = 20
    };
}

struct heap_statistics heap_get_statistics(void) {
    return (struct heap_statistics) {
        .page_count = 2,
        .used_bytes = 128,
        .free_bytes = 7000
    };
}

struct process *process_current(void) {
    return &test_process;
}

uint64_t scheduler_tick_count(void) {
    return 7;
}

bool scheduler_set_quantum(uint64_t ticks) {
    if (ticks == 0) {
        return false;
    }
    test_quantum = ticks;
    return true;
}

uint64_t scheduler_quantum(void) {
    return test_quantum;
}

uint64_t scheduler_context_switch_count(void) {
    return 5;
}

static bool execute(const char *input) {
    char line[EXECOS_FS_MAX_PATH_LENGTH + EXECOS_FS_FILE_CAPACITY];
    size_t length = strlen(input);
    if (length >= sizeof(line)) {
        return false;
    }
    memcpy(line, input, length + 1);
    return shell_execute_line(line);
}

int main(void) {
    CHECK(trace_initialize());
    CHECK(fs_initialize());
    CHECK(fs_mkdir("/home"));

    reset_output();
    CHECK(execute("help"));
    CHECK(strstr(output, "write <path> <text>") != NULL);

    CHECK(execute("cd /home"));
    reset_output();
    CHECK(execute("pwd"));
    CHECK(strcmp(output, "/home\n") == 0);

    CHECK(execute("mkdir work"));
    CHECK(execute("cd work"));
    CHECK(execute("write hello.txt ExecOS kernel data"));
    reset_output();
    CHECK(execute("cat hello.txt"));
    CHECK(strcmp(output, "ExecOS kernel data\n") == 0);
    CHECK(execute("write hello.txt short"));
    reset_output();
    CHECK(execute("cat hello.txt"));
    CHECK(strcmp(output, "short\n") == 0);

    reset_output();
    CHECK(execute("ls"));
    CHECK(strstr(output, "file 5  hello.txt") != NULL);
    CHECK(execute("mv hello.txt moved.txt"));
    CHECK(execute("touch empty.txt"));
    CHECK(execute("rm empty.txt"));

    reset_output();
    CHECK(execute("ps"));
    CHECK(strstr(output, "42    1  RUNNING  9  shell-test") != NULL);

    reset_output();
    CHECK(execute("scheduler"));
    CHECK(strstr(output, "policy=round-robin quantum=1 ticks tick=7 context_switches=5") != NULL);
    CHECK(execute("scheduler 4"));
    CHECK(test_quantum == 4);
    CHECK(strstr(output, "quantum=4 ticks") != NULL);
    CHECK(!execute("scheduler 0"));
    CHECK(!execute("scheduler 4x"));
    CHECK(execute("kill 77"));
    CHECK(terminated_pid == 77);
    CHECK(strstr(output, "terminated process 77") != NULL);
    CHECK(!execute("kill 77x"));
    CHECK(!execute("kill 78"));

    reset_output();
    CHECK(execute("memory"));
    CHECK(strstr(output, "managed=100 free=80 allocated=20") != NULL);
    CHECK(strstr(output, "pages=2 used_bytes=128 free_bytes=7000") != NULL);

    reset_output();
    CHECK(execute("trace"));
    CHECK(strstr(output, "file-create") != NULL);
    CHECK(strstr(output, "file-rename") != NULL);
    CHECK(strstr(output, "file-write") != NULL);
    CHECK(strstr(output, "file-read") != NULL);

    reset_output();
    CHECK(!execute("no-such-command"));
    CHECK(strstr(output, "unknown command: no-such-command") != NULL);

    puts("ExecOS kernel shell command tests passed.");
    return 0;
}
