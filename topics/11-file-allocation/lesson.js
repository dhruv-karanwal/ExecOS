// ExecOS · File Allocation · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 122-141
//   frontend/src/theoryContent.js lines 287-291
//   frontend/src/theoryContent.js lines 358-365

export const theory = {
  "File Management": {
    overview: "File management organizes named data, metadata, directories, and the mapping between a file's logical contents and storage blocks. Allocation strategies trade off contiguous access, growth, random access, metadata overhead, and fragmentation. This lesson simulates block placement; it does not access or modify host files.",
    simple: "A file system stores file data and the information needed to find it again. Allocation policy determines how a file's logical blocks map onto storage blocks.",
    analogy: "Think of a book's pages stored on shelves: contiguous allocation puts them together, linked allocation follows a chain of locations, and indexed allocation uses a separate list of locations. This helps compare access patterns, but actual file systems have more metadata, caching, and recovery concerns.",
    realWorld: "When an application saves a file, the OS and file system update metadata and arrange storage blocks. The actual layout depends on the file system, available space, allocation policy, and later writes; this lab only simulates simple block placement.",
    recap: ["Contiguous allocation needs a long enough run; linked allocation follows pointers; indexed allocation uses a block of references.", "The methods trade off growth, sequential access, direct access, and metadata space.", "The simulator's virtual block map never reads or writes host files."],
    selfCheck: "Why can indexed allocation support direct lookup more easily than a linked chain?",
    selfCheckAnswer: "An index block stores references to the file's data blocks, so a particular block can be located through the index. A linked layout usually requires following pointers from earlier blocks.",
    objectives: [
      "Compare sequential (contiguous), linked, and indexed block allocation.",
      "Trace file-to-block mappings and detect when a request cannot be allocated.",
      "Explain how allocation strategy affects sequential and direct access.",
    ],
    terms: ["file metadata", "logical block", "physical block", "contiguous allocation", "linked allocation", "index block"],
    rules: ["A file of size k blocks needs k data blocks under all three methods.", "Sequential allocation also requires those k data blocks to be contiguous.", "Linked allocation stores a next-block link; indexed allocation stores block references in an index block.", "In this simulator, indexed allocation reserves one additional block for the index."],
    example: "A five-block file needs five consecutive free blocks under sequential allocation. Linked allocation can use scattered free blocks by storing a next pointer. Indexed allocation stores the five block addresses in a separate index block, which itself consumes storage.",
    steps: ["Read each file's requested number of data blocks.", "Find free blocks using the selected allocation structure.", "Reserve required data and metadata blocks and record their links or index.", "Report partial/failed placement and update the remaining free-block map."],
    pitfalls: ["Enough total free blocks do not guarantee a sufficiently long contiguous run.", "Linked allocation supports growth but pointer traversal makes direct access slower; indexed allocation trades an index block for direct lookup."],
    connections: ["Directory entries map names to file objects; they are separate from physical block allocation.", "Real filesystems also handle permissions, caching, crash consistency, and concurrent updates."],
  },
};

export const visualizationGuide = {
  "File Management": {
    summary: "Compare how sequential, linked, and indexed allocation map file data onto storage blocks.",
    focus: ["Which physical blocks each file receives", "Contiguous-run requirements versus pointer chains or an index block", "The metadata and access tradeoffs shown by each method"],
    scope: "The disk-block map is simulated and never creates or changes files on the host computer.",
  },
};

export const glossary = {
  "File Management": [
    ["file metadata", "Information describing a file, such as its size, ownership, permissions, and storage mapping."],
    ["logical block", "A block position within a file, independent of where its data is stored physically."],
    ["physical block", "A storage-device block that holds file data or filesystem metadata."],
    ["contiguous allocation", "Store a file's data blocks in consecutive physical locations."],
    ["linked allocation", "Connect a file's scattered data blocks with pointers from one block to the next."],
    ["index block", "A metadata block that records the physical locations of a file's data blocks."],
  ],
};
