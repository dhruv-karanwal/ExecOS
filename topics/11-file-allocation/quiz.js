// ExecOS · File Allocation · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 144-165
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "File Management": [
    ["Which allocation method follows pointers between blocks?", ["Linked", "Sequential", "Indexed"], 0, "Linked allocation chains blocks with pointers."],
    ["What is an advantage of indexed allocation?", ["Direct lookup through an index", "No metadata overhead", "Always contiguous blocks"], 0, "The index maps logical positions to data blocks."],
    ["What is a limitation of sequential allocation?", ["It needs a large contiguous free run", "It cannot read sequentially", "It stores no locations"], 0, "The full file must fit in adjacent blocks."],
    ["What does a linked block pointer identify?", ["The next block in the file", "The next CPU process", "A segment limit"], 0, "Each pointer links to the next data block."],
    ["What extra structure does indexed allocation reserve?", ["An index block", "A CPU queue", "A page fault"], 0, "An index block stores references to the file's data blocks."],
    ["Why can linked allocation grow easily?", ["Blocks need not be adjacent", "Every file has a fixed maximum length", "It reserves one contiguous run"], 0, "Free blocks anywhere can be linked into the file."],
    ["What does a file's logical block number represent?", ["Its position within the file", "Its process priority", "Its disk head direction"], 0, "Logical block numbers describe file-relative positions."],
    ["What can prevent sequential allocation?", ["No sufficiently large contiguous run", "No CPU quantum", "An empty directory name"], 0, "Total free space may exist but be fragmented."],
    ["What is a common cost of linked allocation?", ["Pointer traversal for random access", "A required contiguous run", "No ability to grow"], 0, "Finding a distant block may require following the chain."],
    ["What is a common cost of indexed allocation?", ["Space and capacity for the index", "Mandatory head reversal", "A CPU context switch"], 0, "The index consumes storage and has a finite pointer capacity."],
    ["What does the file block map visualize?", ["Which simulated disk blocks belong to each file", "The CPU's register contents", "The process's response time"], 0, "The block map displays data and metadata placement."],
    ["What does a free disk block mean?", ["No simulated file currently owns it", "It is a page frame", "It is a ready process"], 0, "A free block can be considered for file allocation."],
    ["What does sequential allocation favor?", ["Contiguous sequential access", "Pointer-only traversal", "No disk layout"], 0, "Adjacent blocks support efficient sequential reads."],
    ["Which allocation method stores block references separately?", ["Indexed", "FCFS", "First Fit"], 0, "Indexed allocation keeps references in an index structure."],
    ["Can linked file blocks be physically scattered?", ["Yes", "No, they must always be adjacent", "Only if the file is empty"], 0, "Pointers allow linked blocks to reside in different locations."],
    ["What does allocation failure mean in the lab?", ["The requested file could not be fully placed", "The CPU ran out of quantum", "A process entered READY"], 0, "The method could not satisfy the file's block request."],
    ["What should a method comparison keep constant?", ["File sizes and disk capacity", "Every method's result", "The file names only"], 0, "Identical input lets the allocation strategies be compared fairly."],
    ["Does this block-allocation lab write to the host filesystem?", ["No, it simulates blocks in the browser", "Yes, it overwrites disk blocks", "Only for indexed files"], 0, "The visualization is isolated and does not alter host files."],
    ["What does a file system directory primarily organize?", ["Names and file entries", "CPU time slices", "Page frames"], 0, "Directories map names to filesystem objects."],
    ["What does a file allocation strategy map?", ["File data to storage blocks", "Processes to priorities", "Segments to CPU cores"], 0, "Allocation records where a file's contents are stored."],
  ],
};
