// ExecOS · System Calls · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 112-122

export const challenge = {
    id: "syscall-validation",
    topic: "System Calls",
    level: "Intermediate",
    title: "Validate a read request",
    scenario: "An application asks the kernel to read from a file descriptor into a user buffer. What should the kernel do before performing the read?",
    options: ["Trust the supplied descriptor and pointer", "Validate the descriptor, buffer access, and permissions", "Switch permanently into user mode"],
    answer: 1,
    hint: "User-supplied arguments are not automatically valid or authorized.",
    explanation: "The kernel must safely validate the descriptor, caller memory, and access rights before serving the request. It returns data or an error through the system-call interface.",
  };
