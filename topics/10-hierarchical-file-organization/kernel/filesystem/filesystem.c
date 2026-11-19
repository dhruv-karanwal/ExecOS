#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "filesystem/filesystem.h"
#include "process/process.h"
#include "scheduler/scheduler.h"
#include "tracing/trace.h"

struct fs_node {
    char name[EXECOS_FS_MAX_NAME_LENGTH + 1];
    enum fs_node_type type;
    size_t parent;
    size_t size;
    uint8_t data[EXECOS_FS_FILE_CAPACITY];
    bool used;
};

struct fs_open_file {
    size_t node;
    size_t offset;
    uint8_t flags;
    bool used;
};

struct fs_path {
    size_t count;
    char components[EXECOS_FS_MAX_COMPONENTS]
                   [EXECOS_FS_MAX_NAME_LENGTH + 1];
};

static struct fs_node nodes[EXECOS_FS_MAX_NODES];
static struct fs_open_file open_files[EXECOS_FS_MAX_OPEN_FILES];
static size_t current_directory;
static bool initialized;

static void trace_filesystem_event(enum trace_event_type type, uint64_t detail) {
    struct process *current = process_current();
    trace_record(
        type,
        scheduler_tick_count(),
        current ? current->pid : 0,
        0,
        detail
    );
}

static size_t string_length(const char *value) {
    size_t length = 0;
    while (value[length] != '\0') {
        length++;
    }
    return length;
}

static bool strings_equal(const char *left, const char *right) {
    size_t index = 0;
    while (left[index] != '\0' && right[index] != '\0') {
        if (left[index] != right[index]) {
            return false;
        }
        index++;
    }
    return left[index] == right[index];
}

static void copy_string(char *destination, const char *source, size_t length) {
    for (size_t index = 0; index < length; index++) {
        destination[index] = source[index];
    }
    destination[length] = '\0';
}

static bool parse_path(const char *path, struct fs_path *parsed) {
    if (!initialized || !path || !parsed) {
        return false;
    }
    size_t length = string_length(path);
    if (length == 0 || length > EXECOS_FS_MAX_PATH_LENGTH) {
        return false;
    }
    parsed->count = 0;
    size_t cursor = path[0] == '/' ? 1 : 0;
    if (path[0] != '/') {
        size_t chain[EXECOS_FS_MAX_COMPONENTS];
        size_t chain_count = 0;
        size_t current = current_directory;
        while (current != 0) {
            if (chain_count == EXECOS_FS_MAX_COMPONENTS) {
                return false;
            }
            chain[chain_count++] = current;
            current = nodes[current].parent;
        }
        while (chain_count > 0) {
            size_t node = chain[--chain_count];
            size_t name_length = string_length(nodes[node].name);
            copy_string(
                parsed->components[parsed->count++],
                nodes[node].name,
                name_length
            );
        }
    }
    while (cursor < length) {
        while (cursor < length && path[cursor] == '/') {
            cursor++;
        }
        if (cursor == length) {
            break;
        }
        size_t start = cursor;
        while (cursor < length && path[cursor] != '/') {
            cursor++;
        }
        size_t component_length = cursor - start;
        if (component_length == 1 && path[start] == '.') {
            continue;
        }
        if (component_length == 2 && path[start] == '.' &&
            path[start + 1] == '.') {
            if (parsed->count > 0) {
                parsed->count--;
            }
            continue;
        }
        if (component_length == 0 ||
            component_length > EXECOS_FS_MAX_NAME_LENGTH ||
            parsed->count >= EXECOS_FS_MAX_COMPONENTS) {
            return false;
        }
        copy_string(
            parsed->components[parsed->count++],
            path + start,
            component_length
        );
    }
    return true;
}

static size_t find_child(size_t parent, const char *name) {
    for (size_t index = 1; index < EXECOS_FS_MAX_NODES; index++) {
        if (nodes[index].used && nodes[index].parent == parent &&
            strings_equal(nodes[index].name, name)) {
            return index;
        }
    }
    return EXECOS_FS_MAX_NODES;
}

static bool resolve_path(const struct fs_path *path, size_t *node_index) {
    size_t current = 0;
    for (size_t component = 0; component < path->count; component++) {
        if (nodes[current].type != FS_NODE_DIRECTORY) {
            return false;
        }
        current = find_child(current, path->components[component]);
        if (current == EXECOS_FS_MAX_NODES) {
            return false;
        }
    }
    *node_index = current;
    return true;
}

static bool resolve_parent(
    const struct fs_path *path,
    size_t *parent_index,
    const char **name
) {
    if (path->count == 0) {
        return false;
    }
    struct fs_path parent_path = *path;
    *name = path->components[path->count - 1];
    parent_path.count--;
    if (!resolve_path(&parent_path, parent_index) ||
        nodes[*parent_index].type != FS_NODE_DIRECTORY) {
        return false;
    }
    return true;
}

static size_t allocate_node(
    size_t parent,
    const char *name,
    enum fs_node_type type
) {
    for (size_t index = 1; index < EXECOS_FS_MAX_NODES; index++) {
        if (!nodes[index].used) {
            size_t length = string_length(name);
            copy_string(nodes[index].name, name, length);
            nodes[index].type = type;
            nodes[index].parent = parent;
            nodes[index].size = 0;
            nodes[index].used = true;
            return index;
        }
    }
    return EXECOS_FS_MAX_NODES;
}

static bool create_node(const char *path, enum fs_node_type type) {
    struct fs_path parsed;
    if (!parse_path(path, &parsed)) {
        return false;
    }
    size_t parent;
    const char *name;
    if (!resolve_parent(&parsed, &parent, &name) ||
        find_child(parent, name) != EXECOS_FS_MAX_NODES) {
        return false;
    }
    size_t created = allocate_node(parent, name, type);
    if (created == EXECOS_FS_MAX_NODES) {
        return false;
    }
    trace_filesystem_event(
        TRACE_FILE_CREATE,
        ((uint64_t)type << 32) | created
    );
    return true;
}

bool fs_initialize(void) {
    if (initialized) {
        return false;
    }
    for (size_t index = 0; index < EXECOS_FS_MAX_NODES; index++) {
        nodes[index].used = false;
    }
    for (size_t index = 0; index < EXECOS_FS_MAX_OPEN_FILES; index++) {
        open_files[index].used = false;
    }
    nodes[0].name[0] = '/';
    nodes[0].name[1] = '\0';
    nodes[0].type = FS_NODE_DIRECTORY;
    nodes[0].parent = 0;
    nodes[0].size = 0;
    nodes[0].used = true;
    current_directory = 0;
    initialized = true;
    return true;
}

bool fs_create_file(const char *path) {
    return create_node(path, FS_NODE_FILE);
}

bool fs_mkdir(const char *path) {
    return create_node(path, FS_NODE_DIRECTORY);
}

bool fs_remove(const char *path) {
    struct fs_path parsed;
    size_t target;
    if (!parse_path(path, &parsed) || !resolve_path(&parsed, &target) ||
        target == 0) {
        return false;
    }
    if (nodes[target].type == FS_NODE_DIRECTORY) {
        if (target == current_directory) {
            return false;
        }
        for (size_t index = 1; index < EXECOS_FS_MAX_NODES; index++) {
            if (nodes[index].used && nodes[index].parent == target) {
                return false;
            }
        }
    } else {
        for (size_t index = 0; index < EXECOS_FS_MAX_OPEN_FILES; index++) {
            if (open_files[index].used && open_files[index].node == target) {
                return false;
            }
        }
    }
    nodes[target].used = false;
    trace_filesystem_event(TRACE_FILE_REMOVE, target);
    return true;
}

static bool is_descendant(size_t directory, size_t ancestor) {
    size_t current = directory;
    while (current != 0) {
        if (current == ancestor) {
            return true;
        }
        current = nodes[current].parent;
    }
    return ancestor == 0;
}

bool fs_rename(const char *source_path, const char *destination_path) {
    struct fs_path source_parsed;
    struct fs_path destination_parsed;
    size_t source;
    size_t destination_parent;
    const char *destination_name;
    if (!parse_path(source_path, &source_parsed) ||
        !parse_path(destination_path, &destination_parsed) ||
        !resolve_path(&source_parsed, &source) || source == 0 ||
        !resolve_parent(
            &destination_parsed,
            &destination_parent,
            &destination_name
        )) {
        return false;
    }
    if (nodes[source].type == FS_NODE_DIRECTORY &&
        is_descendant(destination_parent, source)) {
        return false;
    }
    size_t existing = find_child(destination_parent, destination_name);
    if (existing != EXECOS_FS_MAX_NODES && existing != source) {
        return false;
    }
    size_t name_length = string_length(destination_name);
    copy_string(nodes[source].name, destination_name, name_length);
    nodes[source].parent = destination_parent;
    trace_filesystem_event(TRACE_FILE_RENAME, source);
    return true;
}

int fs_open(const char *path, uint8_t flags) {
    const uint8_t valid_flags =
        FS_OPEN_READ | FS_OPEN_WRITE | FS_OPEN_APPEND | FS_OPEN_TRUNCATE;
    if (flags == 0 || (flags & (uint8_t)~valid_flags) != 0 ||
        ((flags & (FS_OPEN_APPEND | FS_OPEN_TRUNCATE)) != 0 &&
         (flags & FS_OPEN_WRITE) == 0) ||
        (flags & (FS_OPEN_APPEND | FS_OPEN_TRUNCATE)) ==
            (FS_OPEN_APPEND | FS_OPEN_TRUNCATE)) {
        return -1;
    }
    struct fs_path parsed;
    size_t target;
    if (!parse_path(path, &parsed) || !resolve_path(&parsed, &target) ||
        nodes[target].type != FS_NODE_FILE) {
        return -1;
    }
    for (size_t index = 0; index < EXECOS_FS_MAX_OPEN_FILES; index++) {
        if (!open_files[index].used) {
            open_files[index].node = target;
            if ((flags & FS_OPEN_TRUNCATE) != 0) {
                nodes[target].size = 0;
            }
            open_files[index].offset = (flags & FS_OPEN_APPEND) != 0
                ? nodes[target].size
                : 0;
            open_files[index].flags = flags;
            open_files[index].used = true;
            trace_filesystem_event(TRACE_FILE_OPEN, target);
            return (int)index + 1;
        }
    }
    return -1;
}

static struct fs_open_file *get_open_file(int descriptor) {
    if (descriptor <= 0 || descriptor > EXECOS_FS_MAX_OPEN_FILES) {
        return NULL;
    }
    struct fs_open_file *file = &open_files[(size_t)descriptor - 1];
    return file->used ? file : NULL;
}

bool fs_close(int descriptor) {
    struct fs_open_file *file = get_open_file(descriptor);
    if (!file) {
        return false;
    }
    file->used = false;
    return true;
}

int64_t fs_read(int descriptor, void *buffer, size_t size) {
    struct fs_open_file *file = get_open_file(descriptor);
    if (!file || (file->flags & FS_OPEN_READ) == 0 || (!buffer && size != 0)) {
        return -1;
    }
    struct fs_node *node = &nodes[file->node];
    size_t available = node->size - file->offset;
    size_t amount = size < available ? size : available;
    uint8_t *destination = buffer;
    for (size_t index = 0; index < amount; index++) {
        destination[index] = node->data[file->offset + index];
    }
    file->offset += amount;
    trace_filesystem_event(TRACE_FILE_READ, amount);
    return (int64_t)amount;
}

int64_t fs_write(int descriptor, const void *buffer, size_t size) {
    struct fs_open_file *file = get_open_file(descriptor);
    if (!file || (file->flags & FS_OPEN_WRITE) == 0 ||
        (!buffer && size != 0)) {
        return -1;
    }
    struct fs_node *node = &nodes[file->node];
    size_t available = EXECOS_FS_FILE_CAPACITY - file->offset;
    size_t amount = size < available ? size : available;
    const uint8_t *source = buffer;
    for (size_t index = 0; index < amount; index++) {
        node->data[file->offset + index] = source[index];
    }
    file->offset += amount;
    if (file->offset > node->size) {
        node->size = file->offset;
    }
    trace_filesystem_event(TRACE_FILE_WRITE, amount);
    return (int64_t)amount;
}

bool fs_list(
    const char *path,
    struct fs_directory_entry *entries,
    size_t capacity,
    size_t *entry_count
) {
    struct fs_path parsed;
    size_t directory;
    if (!entry_count || (capacity > 0 && !entries) ||
        !parse_path(path, &parsed) || !resolve_path(&parsed, &directory) ||
        nodes[directory].type != FS_NODE_DIRECTORY) {
        return false;
    }
    size_t count = 0;
    for (size_t index = 1; index < EXECOS_FS_MAX_NODES; index++) {
        if (!nodes[index].used || nodes[index].parent != directory) {
            continue;
        }
        if (count < capacity) {
            size_t length = string_length(nodes[index].name);
            copy_string(entries[count].name, nodes[index].name, length);
            entries[count].type = nodes[index].type;
            entries[count].size = nodes[index].size;
        }
        count++;
    }
    *entry_count = count;
    return count <= capacity;
}

bool fs_chdir(const char *path) {
    struct fs_path parsed;
    size_t directory;
    if (!parse_path(path, &parsed) || !resolve_path(&parsed, &directory) ||
        nodes[directory].type != FS_NODE_DIRECTORY) {
        return false;
    }
    current_directory = directory;
    return true;
}

bool fs_getcwd(char *buffer, size_t capacity) {
    if (!initialized || !buffer || capacity == 0) {
        return false;
    }
    if (current_directory == 0) {
        if (capacity < 2) {
            return false;
        }
        buffer[0] = '/';
        buffer[1] = '\0';
        return true;
    }
    size_t chain[EXECOS_FS_MAX_COMPONENTS];
    size_t count = 0;
    size_t current = current_directory;
    while (current != 0) {
        if (count == EXECOS_FS_MAX_COMPONENTS) {
            return false;
        }
        chain[count++] = current;
        current = nodes[current].parent;
    }
    size_t required = 1;
    for (size_t index = 0; index < count; index++) {
        required += string_length(nodes[chain[index]].name) + 1;
    }
    if (required > capacity) {
        return false;
    }
    size_t output = 0;
    buffer[output++] = '/';
    while (count > 0) {
        size_t node = chain[--count];
        size_t length = string_length(nodes[node].name);
        for (size_t index = 0; index < length; index++) {
            buffer[output++] = nodes[node].name[index];
        }
        if (count > 0) {
            buffer[output++] = '/';
        }
    }
    buffer[output] = '\0';
    return true;
}
