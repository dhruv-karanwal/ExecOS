// ExecOS · Hierarchical File Organization · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 101-111

export const challenge = {
    id: "path-resolution",
    topic: "Hierarchical File Organization",
    level: "Beginner",
    title: "Resolve an absolute path",
    scenario: "A process is currently in /tmp and must open /home/learner/notes.txt. Where does resolution of this absolute path begin?",
    options: ["At /tmp, the current directory", "At the filesystem namespace root", "At the final file name"],
    answer: 1,
    hint: "An absolute path is independent of the process's current working directory.",
    explanation: "An absolute path begins at the namespace root, then resolves each component in order. The current directory is used as the starting point for relative paths.",
  };
