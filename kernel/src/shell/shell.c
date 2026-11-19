#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "arch/x86_64/serial.h"
#include "filesystem/filesystem.h"
#include "memory/heap.h"
#include "memory/pmm.h"
#include "process/process.h"
#include "scheduler/scheduler.h"
#include "shell/shell.h"
#include "tracing/trace.h"

#define SHELL_LINE_CAPACITY 256

static bool text_equal(const char *left, const char *right) {
    size_t index = 0;
    while (left[index] != '\0' && right[index] != '\0') {
        if (left[index] != right[index]) {
            return false;
        }
        index++;
    }
    return left[index] == right[index];
}

static char *skip_spaces(char *text) {
    while (*text == ' ' || *text == '\t') {
        text++;
    }
    return text;
}

static void write_process_state(enum process_state state) {
    switch (state) {
        case PROCESS_NEW: serial_write_text("NEW"); break;
        case PROCESS_READY: serial_write_text("READY"); break;
        case PROCESS_RUNNING: serial_write_text("RUNNING"); break;
        case PROCESS_WAITING: serial_write_text("WAITING"); break;
        case PROCESS_TERMINATED: serial_write_text("TERMINATED"); break;
        default: serial_write_text("INVALID"); break;
    }
}

static void write_trace_type(enum trace_event_type type) {
    switch (type) {
        case TRACE_TIMER_INTERRUPT: serial_write_text("timer"); break;
        case TRACE_CONTEXT_SWITCH: serial_write_text("context-switch"); break;
        case TRACE_PROCESS_CREATE: serial_write_text("process-create"); break;
        case TRACE_PROCESS_EXIT: serial_write_text("process-exit"); break;
        case TRACE_EXCEPTION: serial_write_text("exception"); break;
        case TRACE_FILE_CREATE: serial_write_text("file-create"); break;
        case TRACE_FILE_REMOVE: serial_write_text("file-remove"); break;
        case TRACE_FILE_RENAME: serial_write_text("file-rename"); break;
        case TRACE_FILE_OPEN: serial_write_text("file-open"); break;
        case TRACE_FILE_READ: serial_write_text("file-read"); break;
        case TRACE_FILE_WRITE: serial_write_text("file-write"); break;
        default: serial_write_text("unknown"); break;
    }
}

static void command_help(void) {
    serial_write_line("help clear pwd cd ls mkdir touch cat write rm mv ps kill memory scheduler trace uname");
    serial_write_line("write <path> <text> replaces file contents; files are volatile RAM data.");
}

static bool command_list(const char *path) {
    struct fs_directory_entry entries[EXECOS_FS_MAX_NODES];
    size_t count = 0;
    if (!fs_list(path, entries, EXECOS_FS_MAX_NODES, &count)) {
        serial_write_line("ls: path is not a directory or could not be read");
        return false;
    }
    for (size_t index = 0; index < count; index++) {
        if (entries[index].type == FS_NODE_DIRECTORY) {
            serial_write_text("dir  ");
        } else {
            serial_write_text("file ");
            serial_write_u64(entries[index].size);
            serial_write_text("  ");
        }
        serial_write_line(entries[index].name);
    }
    return true;
}

static bool command_cat(const char *path) {
    int descriptor = fs_open(path, FS_OPEN_READ);
    if (descriptor < 0) {
        serial_write_line("cat: cannot open file");
        return false;
    }
    char contents[64];
    int64_t amount;
    while ((amount = fs_read(descriptor, contents, sizeof(contents))) > 0) {
        for (int64_t index = 0; index < amount; index++) {
            char character[2] = {contents[index], '\0'};
            serial_write_text(character);
        }
    }
    bool closed = fs_close(descriptor);
    if (amount < 0 || !closed) {
        serial_write_line("cat: read failed");
        return false;
    }
    serial_write_line("");
    return true;
}

static bool command_write(char *arguments) {
    char *path = arguments;
    char *separator = path;
    while (*separator != '\0' && *separator != ' ' && *separator != '\t') {
        separator++;
    }
    if (*separator == '\0') {
        serial_write_line("usage: write <path> <text>");
        return false;
    }
    *separator++ = '\0';
    char *contents = skip_spaces(separator);
    if (*path == '\0' || *contents == '\0') {
        serial_write_line("usage: write <path> <text>");
        return false;
    }
    int descriptor = fs_open(path, FS_OPEN_WRITE | FS_OPEN_TRUNCATE);
    if (descriptor < 0) {
        if (!fs_create_file(path)) {
            serial_write_line("write: cannot create file");
            return false;
        }
        descriptor = fs_open(path, FS_OPEN_WRITE | FS_OPEN_TRUNCATE);
    }
    if (descriptor < 0) {
        serial_write_line("write: cannot open file");
        return false;
    }
    size_t length = 0;
    while (contents[length] != '\0') {
        length++;
    }
    int64_t written = fs_write(descriptor, contents, length);
    bool closed = fs_close(descriptor);
    if (written != (int64_t)length || !closed) {
        serial_write_line("write: incomplete write");
        return false;
    }
    serial_write_text("wrote ");
    serial_write_u64((uint64_t)written);
    serial_write_line(" bytes");
    return true;
}

static void command_processes(void) {
    serial_write_line("PID  PPID STATE      CPU_TICKS NAME");
    for (size_t index = 0; index < process_count(); index++) {
        const struct process *process = process_get(index);
        if (!process) {
            continue;
        }
        serial_write_u64(process->pid);
        serial_write_text("    ");
        serial_write_u64(process->parent_pid);
        serial_write_text("  ");
        write_process_state(process->state);
        serial_write_text("  ");
        serial_write_u64(process->cpu_ticks);
        serial_write_text("  ");
        serial_write_line(process->name);
    }
}

static void command_memory(void) {
    struct pmm_statistics frames = pmm_get_statistics();
    struct heap_statistics heap = heap_get_statistics();
    serial_write_text("physical frames: managed=");
    serial_write_u64(frames.managed_frames);
    serial_write_text(" free=");
    serial_write_u64(frames.free_frames);
    serial_write_text(" allocated=");
    serial_write_u64(frames.allocated_frames);
    serial_write_line("");
    serial_write_text("heap: pages=");
    serial_write_u64(heap.page_count);
    serial_write_text(" used_bytes=");
    serial_write_u64(heap.used_bytes);
    serial_write_text(" free_bytes=");
    serial_write_u64(heap.free_bytes);
    serial_write_line("");
}

static void command_scheduler(void) {
    serial_write_text("policy=round-robin quantum=");
    serial_write_u64(scheduler_quantum());
    serial_write_text(" ticks tick=");
    serial_write_u64(scheduler_tick_count());
    serial_write_text(" context_switches=");
    serial_write_u64(scheduler_context_switch_count());
    serial_write_line("");
}

static bool command_set_quantum(const char *value) {
    uint64_t ticks = 0;
    if (!value || *value == '\0') {
        return false;
    }
    for (size_t index = 0; value[index] != '\0'; index++) {
        if (value[index] < '0' || value[index] > '9') {
            return false;
        }
        uint64_t digit = (uint64_t)(value[index] - '0');
        if (ticks > (UINT64_MAX - digit) / 10) {
            return false;
        }
        ticks = ticks * 10 + digit;
    }
    if (!scheduler_set_quantum(ticks)) {
        return false;
    }
    command_scheduler();
    return true;
}

static bool command_kill(const char *value) {
    uint64_t pid = 0;
    if (!value || *value == '\0') {
        serial_write_line("usage: kill <pid>");
        return false;
    }
    for (size_t index = 0; value[index] != '\0'; index++) {
        if (value[index] < '0' || value[index] > '9') {
            serial_write_line("usage: kill <pid>");
            return false;
        }
        uint64_t digit = (uint64_t)(value[index] - '0');
        if (pid > (UINT64_MAX - digit) / 10) {
            serial_write_line("kill: PID is out of range");
            return false;
        }
        pid = pid * 10 + digit;
    }
    if (!process_terminate(pid, -1)) {
        serial_write_line("kill: process not found, already terminated, or cannot terminate current/kernel process");
        return false;
    }
    serial_write_text("terminated process ");
    serial_write_u64(pid);
    serial_write_line("");
    return true;
}

static void command_trace(void) {
    size_t count = trace_count();
    for (size_t index = 0; index < count; index++) {
        struct trace_event event;
        if (!trace_get(index, &event)) {
            serial_write_line("trace: event read failed");
            return;
        }
        serial_write_text("#");
        serial_write_u64(event.sequence);
        serial_write_text(" tick=");
        serial_write_u64(event.tick);
        serial_write_text(" ");
        write_trace_type(event.type);
        serial_write_text(" pid=");
        serial_write_u64(event.source_pid);
        serial_write_text(" -> ");
        serial_write_u64(event.target_pid);
        serial_write_text(" detail=");
        serial_write_u64(event.detail);
        serial_write_line("");
    }
}

bool shell_execute_line(char *line) {
    if (!line) {
        serial_write_line("shell: invalid input");
        return false;
    }
    char *command = skip_spaces(line);
    if (*command == '\0') {
        return true;
    }
    char *arguments = command;
    while (*arguments != '\0' && *arguments != ' ' && *arguments != '\t') {
        arguments++;
    }
    bool has_arguments = *arguments != '\0';
    if (has_arguments) {
        *arguments++ = '\0';
        arguments = skip_spaces(arguments);
    }

    if (text_equal(command, "help")) {
        command_help();
        serial_write_line("scheduler [quantum_ticks] reports or configures the real kernel round-robin quantum.");
    } else if (text_equal(command, "clear")) {
        serial_write_text("\033[2J\033[H");
    } else if (text_equal(command, "uname")) {
        serial_write_line("ExecOS x86_64 kernel (Limine, QEMU target)");
    } else if (text_equal(command, "pwd")) {
        char path[EXECOS_FS_MAX_PATH_LENGTH + 1];
        if (!fs_getcwd(path, sizeof(path))) {
            serial_write_line("pwd: unable to read current directory");
            return false;
        }
        serial_write_line(path);
    } else if (text_equal(command, "cd")) {
        if (!has_arguments || !fs_chdir(arguments)) {
            serial_write_line("cd: directory not found");
            return false;
        }
    } else if (text_equal(command, "ls")) {
        if (!command_list(has_arguments ? arguments : ".")) {
            return false;
        }
    } else if (text_equal(command, "mkdir")) {
        if (!has_arguments || !fs_mkdir(arguments)) {
            serial_write_line("mkdir: could not create directory");
            return false;
        }
    } else if (text_equal(command, "touch")) {
        if (!has_arguments || !fs_create_file(arguments)) {
            serial_write_line("touch: could not create file");
            return false;
        }
    } else if (text_equal(command, "cat")) {
        if (!has_arguments || !command_cat(arguments)) {
            return false;
        }
    } else if (text_equal(command, "write")) {
        if (!has_arguments || !command_write(arguments)) {
            return false;
        }
    } else if (text_equal(command, "rm")) {
        if (!has_arguments || !fs_remove(arguments)) {
            serial_write_line("rm: could not remove path");
            return false;
        }
    } else if (text_equal(command, "mv")) {
        if (!has_arguments) {
            serial_write_line("usage: mv <source> <destination>");
            return false;
        }
        char *destination = arguments;
        while (*destination != '\0' && *destination != ' ' &&
               *destination != '\t') {
            destination++;
        }
        if (*destination == '\0') {
            serial_write_line("usage: mv <source> <destination>");
            return false;
        }
        *destination++ = '\0';
        destination = skip_spaces(destination);
        if (*destination == '\0' ||
            !fs_rename(arguments, destination)) {
            serial_write_line("mv: could not rename path");
            return false;
        }
    } else if (text_equal(command, "ps")) {
        command_processes();
    } else if (text_equal(command, "kill")) {
        if (!has_arguments || !command_kill(arguments)) {
            if (!has_arguments) {
                serial_write_line("usage: kill <pid>");
            }
            return false;
        }
    } else if (text_equal(command, "memory")) {
        command_memory();
    } else if (text_equal(command, "trace")) {
        command_trace();
    } else if (text_equal(command, "scheduler")) {
        if (has_arguments) {
            if (!command_set_quantum(arguments)) {
                serial_write_line("usage: scheduler [positive_quantum_ticks]");
                return false;
            }
        } else {
            command_scheduler();
        }
    } else {
        serial_write_text("unknown command: ");
        serial_write_line(command);
        return false;
    }
    return true;
}

void shell_run(void) {
    char line[SHELL_LINE_CAPACITY];
    size_t length = 0;
    serial_write_line("ExecOS kernel shell. Type 'help' for commands.");
    __asm__ volatile ("sti" : : : "memory");
    uint64_t shell_entry_tick = scheduler_tick_count();
    while (scheduler_tick_count() == shell_entry_tick) {
        __asm__ volatile ("sti; hlt" : : : "memory");
    }
    serial_write_text("ExecOS: interactive scheduler active at tick ");
    serial_write_u64(scheduler_tick_count());
    serial_write_line(".");
    for (;;) {
        serial_write_text("execos> ");
        length = 0;
        for (;;) {
            char character;
            if (!serial_try_read_character(&character)) {
                __asm__ volatile ("pause");
                continue;
            }
            if (character == '\r' || character == '\n') {
                serial_write_line("");
                break;
            }
            if (character == '\b' || character == 0x7f) {
                if (length > 0) {
                    length--;
                    serial_write_text("\b \b");
                }
                continue;
            }
            if (character >= ' ' && character <= '~' &&
                length + 1 < sizeof(line)) {
                line[length++] = character;
                char echo[2] = {character, '\0'};
                serial_write_text(echo);
            }
        }
        line[length] = '\0';
        shell_execute_line(line);
    }
}
