// ExecOS · Hierarchical File Organization · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 210-231
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "Hierarchical File Organization": [
    ["How is an absolute path distinguished?", ["It begins at the filesystem root", "It contains an extension", "It names a device"], 0, "An absolute path starts at the namespace root."],
    ["What is a directory entry used for?", ["Mapping a name to a filesystem object", "Scheduling a process", "Mapping pages to frames"], 0, "Directory entries associate names with files or child directories."],
    ["Which component is resolved first in /home/user/file?", ["home under root", "file under root", "user under file"], 0, "Traversal begins at root and resolves each component in order."],
    ["Where does a relative path begin?", ["The current working directory", "Always filesystem root", "The first disk cylinder"], 0, "Relative paths start from the caller's current directory."],
    ["What is a benefit of a hierarchical namespace?", ["Different directories can reuse the same name", "All files share one unique short name", "It eliminates traversal"], 0, "Names need only be unique within a directory."],
    ["What if an intermediate path component is missing?", ["The path cannot be resolved", "It becomes root automatically", "It is created automatically"], 0, "Each component must exist in its parent."],
    ["What does a child directory contain?", ["Its own nested entries", "A CPU scheduling policy", "A memory frame"], 0, "Directories can organize further files and subdirectories."],
    ["Which path is absolute?", ["/home/student/notes.txt", "home/student/notes.txt", "student/notes.txt"], 0, "A leading slash identifies an absolute path."],
    ["What is the root directory?", ["The top of the directory hierarchy", "The largest file", "A free disk block"], 0, "The root is the starting point for absolute paths."],
    ["What does a breadcrumb show?", ["The path's ancestor directories", "CPU process priorities", "Disk head movement"], 0, "Breadcrumbs expose the path from root to the current directory."],
    ["Can two different directories contain a file with the same name?", ["Yes", "No, names are globally unique", "Only if both are empty"], 0, "Directory-local naming allows names to repeat in separate directories."],
    ["What does a leaf file entry represent?", ["A file rather than a child directory", "The root directory", "A process state"], 0, "Files are leaf objects in a basic directory tree."],
    ["Why resolve path components one at a time?", ["Each name is looked up within its parent directory", "All names use CPU priority", "The path determines page size"], 0, "Path traversal follows the directory hierarchy in sequence."],
    ["What does a trailing slash commonly indicate?", ["A directory path", "A CPU process", "An absolute address"], 0, "A trailing separator commonly denotes that the target is a directory."],
    ["What is a single-level directory limitation?", ["All file names share one namespace", "It cannot contain files", "It needs page tables"], 0, "A flat directory requires names to be unique in that one directory."],
    ["Why use subdirectories?", ["Group entries and reduce naming conflicts", "Increase CPU burst lengths", "Remove storage blocks"], 0, "Hierarchy provides organization and separate namespaces."],
    ["What is path traversal?", ["Following each directory name to reach a target", "Scheduling processes by burst", "Replacing a memory page"], 0, "Traversal resolves path components from a starting directory."],
    ["What should happen if a path component is a file but more components follow?", ["Traversal fails because a file is not a directory", "The file becomes a directory", "The remaining names are ignored"], 0, "Intermediate path components must be directories."],
    ["Does the ExecOS directory learning tree access host files?", ["No, it is an isolated simulation", "Yes, it modifies the user's directories", "Only when a path is absolute"], 0, "The learning tree is simulated and leaves host files untouched."],
    ["What does a directory tree represent?", ["Parent-child relationships among directories and files", "CPU execution order", "Resource allocation matrices"], 0, "The tree models how names are organized hierarchically."],
  ],
};
