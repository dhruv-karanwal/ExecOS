#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "filesystem/filesystem.h"
#include "tracing/trace.h"

#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 1; \
    } \
} while (0)

struct process;
struct process *process_current(void) {
    return NULL;
}

uint64_t scheduler_tick_count(void) {
    return 7;
}

int main(void) {
    CHECK(!fs_create_file("/before-init"));
    CHECK(trace_initialize());
    CHECK(fs_initialize());
    CHECK(!fs_initialize());
    CHECK(fs_mkdir("/home"));
    CHECK(fs_mkdir("/home/user"));
    CHECK(fs_chdir("/home/user"));

    char cwd[EXECOS_FS_MAX_PATH_LENGTH + 1];
    CHECK(fs_getcwd(cwd, sizeof(cwd)));
    CHECK(strcmp(cwd, "/home/user") == 0);
    CHECK(!fs_getcwd(cwd, 4));

    CHECK(fs_create_file("notes.txt"));
    int descriptor = fs_open("notes.txt", FS_OPEN_WRITE);
    CHECK(descriptor > 0);
    CHECK(fs_read(descriptor, cwd, 1) == -1);
    CHECK(fs_write(descriptor, "hello", 5) == 5);
    CHECK(fs_close(descriptor));
    CHECK(!fs_close(descriptor));

    descriptor = fs_open("notes.txt", FS_OPEN_WRITE | FS_OPEN_APPEND);
    CHECK(descriptor > 0);
    CHECK(fs_write(descriptor, " world", 6) == 6);
    CHECK(fs_close(descriptor));
    CHECK(fs_open(
        "notes.txt",
        FS_OPEN_WRITE | FS_OPEN_APPEND | FS_OPEN_TRUNCATE
    ) == -1);
    descriptor = fs_open("notes.txt", FS_OPEN_WRITE | FS_OPEN_TRUNCATE);
    CHECK(descriptor > 0);
    CHECK(fs_write(descriptor, "short", 5) == 5);
    CHECK(fs_close(descriptor));

    descriptor = fs_open("./notes.txt", FS_OPEN_READ);
    CHECK(descriptor > 0);
    char content[16] = {0};
    CHECK(fs_read(descriptor, content, sizeof(content)) == 5);
    CHECK(strcmp(content, "short") == 0);
    CHECK(fs_read(descriptor, content, sizeof(content)) == 0);
    CHECK(fs_close(descriptor));
    CHECK(fs_open("notes.txt", 0) == -1);
    CHECK(fs_open("missing.txt", FS_OPEN_READ) == -1);

    struct fs_directory_entry entries[2];
    size_t entry_count = 0;
    CHECK(!fs_list(".", entries, 0, &entry_count));
    CHECK(entry_count == 1);
    CHECK(fs_list(".", entries, 1, &entry_count));
    CHECK(entry_count == 1);
    CHECK(strcmp(entries[0].name, "notes.txt") == 0);
    CHECK(entries[0].type == FS_NODE_FILE);
    CHECK(entries[0].size == 5);

    CHECK(fs_mkdir("sub"));
    CHECK(fs_create_file("../sibling.txt"));
    descriptor = fs_open("../sibling.txt", FS_OPEN_WRITE);
    CHECK(descriptor > 0);
    uint8_t block[EXECOS_FS_FILE_CAPACITY] = {0};
    CHECK(fs_write(descriptor, block, sizeof(block)) ==
          (int64_t)sizeof(block));
    CHECK(fs_write(descriptor, block, 1) == 0);
    CHECK(fs_close(descriptor));
    CHECK(fs_remove("../sibling.txt"));
    CHECK(fs_rename("notes.txt", "sub/moved.txt"));
    CHECK(!fs_rename("/home", "/home/user/sub/loop"));
    CHECK(fs_chdir("sub"));
    CHECK(fs_getcwd(cwd, sizeof(cwd)));
    CHECK(strcmp(cwd, "/home/user/sub") == 0);
    descriptor = fs_open("../sub/moved.txt", FS_OPEN_READ);
    CHECK(descriptor > 0);
    CHECK(fs_close(descriptor));
    descriptor = fs_open("/home/user/sub/moved.txt", FS_OPEN_READ);
    CHECK(descriptor > 0);
    CHECK(!fs_remove("/home/user/sub/moved.txt"));
    CHECK(fs_close(descriptor));

    int descriptors[EXECOS_FS_MAX_OPEN_FILES];
    for (size_t index = 0; index < EXECOS_FS_MAX_OPEN_FILES; index++) {
        descriptors[index] = fs_open("moved.txt", FS_OPEN_READ);
        CHECK(descriptors[index] > 0);
    }
    CHECK(fs_open("moved.txt", FS_OPEN_READ) == -1);
    for (size_t index = 0; index < EXECOS_FS_MAX_OPEN_FILES; index++) {
        CHECK(fs_close(descriptors[index]));
    }
    CHECK(fs_remove("moved.txt"));
    CHECK(!fs_remove("."));
    CHECK(fs_chdir("/home/user"));
    CHECK(fs_remove("sub"));
    CHECK(fs_chdir("/"));
    CHECK(fs_remove("/home/user"));
    CHECK(fs_remove("/home"));

    bool saw_create = false;
    bool saw_open = false;
    bool saw_rename = false;
    bool saw_read = false;
    bool saw_write = false;
    bool saw_remove = false;
    for (size_t index = 0; index < trace_count(); index++) {
        struct trace_event event;
        CHECK(trace_get(index, &event));
        saw_create |= event.type == TRACE_FILE_CREATE;
        saw_open |= event.type == TRACE_FILE_OPEN;
        saw_rename |= event.type == TRACE_FILE_RENAME;
        saw_read |= event.type == TRACE_FILE_READ;
        saw_write |= event.type == TRACE_FILE_WRITE;
        saw_remove |= event.type == TRACE_FILE_REMOVE;
    }
    CHECK(saw_create && saw_open && saw_rename && saw_read && saw_write &&
          saw_remove);

    puts("Kernel in-memory filesystem tests passed.");
    return 0;
}
