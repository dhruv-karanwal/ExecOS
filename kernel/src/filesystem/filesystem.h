#ifndef EXECOS_FILESYSTEM_H
#define EXECOS_FILESYSTEM_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define EXECOS_FS_MAX_NODES 64
#define EXECOS_FS_MAX_OPEN_FILES 16
#define EXECOS_FS_MAX_NAME_LENGTH 31
#define EXECOS_FS_MAX_PATH_LENGTH 255
#define EXECOS_FS_MAX_COMPONENTS 64
#define EXECOS_FS_FILE_CAPACITY 1024

enum fs_node_type {
    FS_NODE_FILE,
    FS_NODE_DIRECTORY
};

enum fs_open_flags {
    FS_OPEN_READ = 1,
    FS_OPEN_WRITE = 2,
    FS_OPEN_APPEND = 4,
    FS_OPEN_TRUNCATE = 8
};

struct fs_directory_entry {
    char name[EXECOS_FS_MAX_NAME_LENGTH + 1];
    enum fs_node_type type;
    size_t size;
};

bool fs_initialize(void);
bool fs_create_file(const char *path);
bool fs_mkdir(const char *path);
bool fs_remove(const char *path);
bool fs_rename(const char *source_path, const char *destination_path);
int fs_open(const char *path, uint8_t flags);
bool fs_close(int descriptor);
int64_t fs_read(int descriptor, void *buffer, size_t size);
int64_t fs_write(int descriptor, const void *buffer, size_t size);
bool fs_list(
    const char *path,
    struct fs_directory_entry *entries,
    size_t capacity,
    size_t *entry_count
);
bool fs_chdir(const char *path);
bool fs_getcwd(char *buffer, size_t capacity);

#endif
