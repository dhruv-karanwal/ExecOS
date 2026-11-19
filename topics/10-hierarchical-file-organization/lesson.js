// ExecOS · Hierarchical File Organization · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 182-201
//   frontend/src/theoryContent.js lines 292-296
//   frontend/src/theoryContent.js lines 382-389

export const theory = {
  "Hierarchical File Organization": {
    overview: "A directory is a namespace that maps names to files or child directories. A hierarchical filesystem forms a tree: absolute paths begin at the root and relative paths begin at a current directory. Each component is resolved in its parent; directory organization is distinct from the way a file's data blocks are allocated.",
    simple: "A directory tree organizes names. To find a target, the system starts at the root or current directory and resolves each path component in order.",
    analogy: "A path is like directions through nested folders: open the parent folder, find the next named folder, and continue until the target. A directory is a namespace, not necessarily a physical container holding all file data.",
    realWorld: "When a program opens a path, the OS resolves names through directory entries, applies permissions, and returns a file handle or an error. Mount points, symbolic links, and permissions add behaviors beyond this simplified tree.",
    recap: ["Absolute paths start at the root; relative paths start at the current directory.", "Each component is looked up in its parent, and intermediate components must be directories.", "Directory naming and file-data block allocation are related but separate concerns."],
    selfCheck: "Why does resolving an absolute path begin differently from resolving a relative path?",
    selfCheckAnswer: "An absolute path is rooted at the filesystem namespace root. A relative path is interpreted from the process's current working directory.",
    objectives: [
      "Trace absolute and relative paths component by component.",
      "Explain parent-child relationships, name scope, and directory entries.",
      "Identify common path-resolution failures without confusing directories with file data.",
    ],
    terms: ["root", "directory entry", "absolute path", "relative path", "current directory", "path component"],
    rules: ["An absolute path starts at the namespace root; a relative path starts at the current directory.", "Each path component is looked up in its parent directory.", "Every intermediate component must resolve to a directory.", "A missing entry or non-directory intermediate component makes traversal fail."],
    example: "To resolve /home/student/notes.txt, start at root, find home, then student inside home, and finally notes.txt inside student. The relative path notes.txt instead starts from the process's current directory.",
    steps: ["Choose root for an absolute path or the process current directory for a relative path.", "Look up the next component in the current directory.", "Require intermediate components to be directories and continue traversal.", "Return the target entry or report the missing/invalid component."],
    pitfalls: ["Names generally need to be unique within one directory, not across the whole filesystem.", "A directory tree describes names and relationships; file allocation describes where file contents live."],
    connections: ["A file allocation table/block map relates a file to storage blocks after its name is resolved.", "Real systems add permissions, symbolic links, mounts, and concurrent rename semantics."],
  },
};

export const visualizationGuide = {
  "Hierarchical File Organization": {
    summary: "Resolve a path one directory entry at a time, from the root or current directory to its final target.",
    focus: ["Where absolute and relative path traversal begins", "Which parent directory is searched for each component", "Whether the final name resolves to a file or directory"],
    scope: "The directory tree is a virtual example; path navigation does not access the host filesystem.",
  },
};

export const glossary = {
  "Hierarchical File Organization": [
    ["root", "The top-level directory from which an absolute path begins."],
    ["directory entry", "A name-to-object mapping held in a directory."],
    ["absolute path", "A path resolved from the namespace root rather than the current directory."],
    ["relative path", "A path resolved from the process's current working directory."],
    ["current directory", "The directory used as the starting point for relative path resolution."],
    ["path component", "One name in a path, looked up in the directory reached by the previous component."],
  ],
};
