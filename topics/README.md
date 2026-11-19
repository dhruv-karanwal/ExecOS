# ExecOS topics

Each OS topic's code, gathered into its own folder. Every file is a verbatim copy of the matching code in `frontend/src`, `backend/app/kernel_engine.py` or `kernel/src`; those originals are unchanged and remain what the app runs.
Each file's header lists the exact source lines it came from.

| # | Topic | Files |
|---|---|---|
| 01 | [System Calls](01-system-calls/) | `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `engine.py` |
| 02 | [CPU Scheduling](02-cpu-scheduling/) | `algorithm.js`, `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `engine.py`, `kernel/` |
| 03 | [Deadlocks](03-deadlocks/) | `algorithm.js`, `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `engine.py` |
| 04 | [Memory Management Techniques](04-memory-management-techniques/) | `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `kernel/` |
| 05 | [Process Synchronization](05-process-synchronization/) | `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js` |
| 06 | [Contiguous Memory](06-contiguous-memory/) | `algorithm.js`, `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `engine.py` |
| 07 | [Page Replacement](07-page-replacement/) | `algorithm.js`, `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `engine.py` |
| 08 | [Paging & Segmentation](08-paging-segmentation/) | `algorithm.js`, `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js` |
| 09 | [Disk Scheduling](09-disk-scheduling/) | `algorithm.js`, `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js` |
| 10 | [Hierarchical File Organization](10-hierarchical-file-organization/) | `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `engine.py`, `kernel/` |
| 11 | [File Allocation](11-file-allocation/) | `algorithm.js`, `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js` |
| 12 | [OS Concepts](12-os-concepts/) | `visualizer.jsx`, `lesson.js`, `quiz.js`, `challenge.js`, `engine.py`, `kernel/` |

`_shared/algorithm-helpers.js` holds the input helpers several `algorithm.js` files import.
