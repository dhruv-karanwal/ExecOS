// ExecOS · Process Synchronization · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 166-187
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "Process Synchronization": [
    ["What does mutual exclusion guarantee?", ["At most one process enters a critical section at a time", "All processes enter together", "Locks are never released"], 0, "Mutual exclusion protects shared state from simultaneous critical-section access."],
    ["What happens when a process cannot acquire a held mutex?", ["It waits until the lock is released", "It enters anyway", "The mutex duplicates"], 0, "A contender blocks or waits for the owner to release the mutex."],
    ["Which is a classic deadlock condition?", ["Circular wait", "Page locality", "Time slicing"], 0, "Circular wait is one of the four classic conditions."],
    ["What is a race condition?", ["An outcome depends on concurrent timing", "A process finishes its burst", "The disk head reverses"], 0, "Unsynchronized interleavings can change a program's result."],
    ["What is a critical section?", ["Code that accesses shared state", "A disk cylinder", "A page table"], 0, "Critical sections operate on data shared by concurrent participants."],
    ["What does a semaphore counter commonly represent?", ["Available resources or signaled events", "Only CPU cores", "Directory depth"], 0, "Semaphores coordinate resource counts or event ordering."],
    ["In Producer–Consumer, what does empty count represent?", ["Available buffer slots", "Active readers", "Waiting disk requests"], 0, "The producer must wait when no buffer slots are empty."],
    ["In Producer–Consumer, what does full count represent?", ["Items ready for consumption", "Free memory blocks", "Ready processes"], 0, "The consumer waits until the buffer contains an item."],
    ["Why does a writer need exclusive access?", ["To prevent concurrent reads or writes during an update", "To allocate a page frame", "To increase CPU throughput"], 0, "Exclusive access keeps shared data consistent during modification."],
    ["When may multiple readers share access?", ["When no writer holds exclusive access", "When the mutex is permanently locked", "Only after every process terminates"], 0, "Readers can safely share read-only access when a writer is absent."],
    ["What is the Dining Philosophers problem used to illustrate?", ["Resource contention and deadlock", "Page replacement", "Disk seek time"], 0, "Philosophers compete for exclusive forks, illustrating circular wait."],
    ["How can a global fork order prevent circular wait?", ["Acquire resources in a consistent order", "Acquire any resource and never release it", "Use a larger page size"], 0, "Ordering prevents a cycle in resource acquisition."],
    ["What is progress in the critical-section problem?", ["If no one is inside, eligible contenders can be selected", "Every process runs at once", "A lock is held forever"], 0, "Progress ensures the choice of a next entrant does not stall indefinitely."],
    ["What is bounded waiting intended to prevent?", ["A contender waiting forever", "A process accessing memory", "A page fault"], 0, "Bounded waiting limits how long a process can be postponed."],
    ["What does a mutex owner do after leaving its critical section?", ["Releases the mutex", "Doubles the lock", "Terminates every waiter"], 0, "The owner releases the mutex so a waiting process can proceed."],
    ["What is hold-and-wait?", ["Holding resources while waiting for more", "Releasing all resources before running", "Waiting for a CPU tick only"], 0, "A process keeps what it holds while requesting additional resources."],
    ["What does wait(mutex) do conceptually?", ["Acquire the lock or block until it is available", "Release the lock", "Create a new process"], 0, "The wait operation obtains the lock when possible."],
    ["What does signal(mutex) do conceptually?", ["Release the lock and allow a waiter to proceed", "Acquire another lock", "Cause a page fault"], 0, "Signal releases the mutex and wakes eligible waiting work."],
    ["Why must lock operations be atomic?", ["To avoid races while changing lock state", "To increase disk capacity", "To make all processes identical"], 0, "Atomic operations prevent simultaneous contenders from both acquiring a lock."],
    ["What is starvation in synchronization?", ["A process waits indefinitely despite continued system activity", "A buffer is empty", "A lock is released"], 0, "Starvation means a participant is continually denied progress."],
  ],
};
