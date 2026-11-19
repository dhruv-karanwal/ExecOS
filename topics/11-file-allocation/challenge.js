// ExecOS · File Allocation · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 79-89

export const challenge = {
    id: "file-scattered-blocks",
    topic: "File Management",
    level: "Beginner",
    title: "Allocate a file into scattered space",
    scenario: "A four-block file must be stored, but free blocks are scattered with no run of four adjacent blocks. Which allocation method can use scattered blocks without requiring one contiguous run?",
    options: ["Contiguous allocation", "Linked allocation", "Fixed partition allocation"],
    answer: 1,
    hint: "This method connects the file's blocks using a pointer from one block to the next.",
    explanation: "Linked allocation can place data blocks in scattered free locations and link them in file order. Contiguous allocation requires one adjacent run large enough for the file.",
  };
