// ExecOS · OS Concepts · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 123-133

export const challenge = {
    id: "os-blocked-process",
    topic: "OS Concepts",
    level: "Beginner",
    title: "Keep the CPU productive",
    scenario: "One process is blocked waiting for disk input while another process is READY. What can the operating system do?",
    options: ["Schedule the READY process while the I/O proceeds", "Treat the blocked process as immediately runnable", "Stop the CPU until the disk finishes"],
    answer: 0,
    hint: "READY means able to run; WAITING means blocked on an event.",
    explanation: "The blocked process cannot use the CPU until I/O completes. The scheduler can dispatch the READY process, allowing useful work to continue while the device operates.",
  };
