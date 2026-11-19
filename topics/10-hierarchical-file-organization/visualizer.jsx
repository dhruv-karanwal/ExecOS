// ExecOS · Hierarchical File Organization · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 208-215
//   frontend/src/AlgorithmStudio.jsx lines 276-280
//   frontend/src/AlgorithmStudio.jsx lines 345-349
//   frontend/src/AlgorithmStudio.jsx lines 909-918
//   frontend/src/AlgorithmStudio.jsx lines 1049-1082
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const descriptions = {
  "Hierarchical File Organization": {
    purpose: "A hierarchical directory tree organizes names into directories and files, allowing paths to be resolved one component at a time.",
    example: "The path /home/student/notes.txt is found by looking up home at root, student inside home, then notes.txt inside student.",
    pseudocode: "node = root\nfor component in path:\n  require component in node.children\n  node = node.children[component]\nreturn node",
    advantages: "Separates namespaces, groups related files, and gives users a navigable path structure.",
    disadvantages: "Path permissions, links, mounts, and concurrent updates are not modeled by this teaching tree.",
    complexity: "O(D) path component lookups", space: "O(N) directory entries",
  },
};

const deepTheory = {
  "Hierarchical File Organization": [
    ["Directories and paths", "A directory maps names to entries representing files or child directories. A path is a sequence of names; an absolute path starts at the root, while a relative path starts at the process's current directory. Resolving a path means searching each component in its parent directory until reaching the target entry."],
    ["Namespace benefits", "Hierarchical directories let separate users and applications reuse simple names without collisions, group related content, and apply permissions at different levels. File metadata identifies ownership and type, while the file's storage mapping is handled separately by allocation and filesystem layers."],
    ["Path traversal and errors", "A path can fail because a component is missing, is not a directory, or is not accessible. Real filesystems also handle symbolic links, mount points, case rules, and concurrent rename operations. This interactive tree demonstrates name resolution only and never reads or writes the host filesystem."],
  ],
};

const legacyQuizFallback = {
  "Hierarchical File Organization": [
    { question: "How is an absolute path distinguished?", options: ["It begins at the filesystem root", "It contains only file extensions", "It always names a device"], answer: 0, explanation: "An absolute path is rooted in the namespace rather than the current directory." },
    { question: "What is a directory entry used for?", options: ["Mapping a name to a filesystem object", "Scheduling a process", "Mapping virtual pages to frames"], answer: 0, explanation: "Directory entries associate names with files or child directories." },
    { question: "Which component is resolved first in /home/user/file?", options: ["home under root", "file under root", "user under file"], answer: 0, explanation: "Path traversal starts at the root and resolves one component at a time." },
  ],
};

const directoryTree = {
  "/": { directories: ["home", "etc", "var"], files: ["README.md"] },
  "/home": { directories: ["student"], files: ["welcome.txt"] },
  "/home/student": { directories: ["projects"], files: ["notes.txt"] },
  "/home/student/projects": { directories: ["os-lab"], files: ["ideas.md"] },
  "/home/student/projects/os-lab": { directories: [], files: ["scheduler.js", "memory-map.json"] },
  "/etc": { directories: [], files: ["execos.conf", "kernel.conf"] },
  "/var": { directories: ["log"], files: [] },
  "/var/log": { directories: [], files: ["engine.log", "events.log"] },
};

function DirectoryTreeLab() {
  const [path, setPath] = useState("/");
  const [view, setView] = useState("hierarchical");
  const [singleFiles, setSingleFiles] = useState(["readme.txt", "grades.csv", "kernel.conf"]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const current = directoryTree[path];
  const ancestors = path === "/" ? ["/"] : ["/", ...path.slice(1).split("/").map((_, index, parts) => `/${parts.slice(0, index + 1).join("/")}`)];
  const addSingleLevelFile = (event) => {
    event.preventDefault();
    const name = fileName.trim();
    if (!name || name.includes("/") || name === "." || name === "..") {
      setFileError("Enter a file name without a path separator.");
      return;
    }
    if (singleFiles.some((file) => file.toLowerCase() === name.toLowerCase())) {
      setFileError("That name already exists in the single-level directory.");
      return;
    }
    setSingleFiles((files) => [...files, name]);
    setFileName("");
    setFileError("");
  };
  return <section className="lab-panel directory-lab">
    <div className="lab-panel-heading"><div><span className="eyebrow">INTERACTIVE DIRECTORY STRUCTURES</span><h3>{view === "hierarchical" ? "Resolve a path by traversing names" : "Single-level directory"}</h3></div><span>SIMULATED · HOST FILES UNTOUCHED</span></div>
    <div className="translation-tabs" role="group" aria-label="Directory structure">{[["hierarchical", "Hierarchical"], ["single", "Single-level"]].map(([key, label]) => <button type="button" className={view === key ? "selected" : ""} aria-pressed={view === key} key={key} onClick={() => setView(key)}>{label}</button>)}</div>
    {view === "single" ? <><div className="how-it-works"><span className="eyebrow">FLAT NAMESPACE</span><p>Every file lives in one directory, so names must be unique and there are no subdirectory paths. Add or remove entries to explore the namespace.</p></div><form className="syscall-form" onSubmit={addSingleLevelFile}><label>New file name<input value={fileName} onChange={(event) => { setFileName(event.target.value); setFileError(""); }} maxLength={80} /></label><button type="submit" className="lab-primary">Add file</button></form>{fileError && <p className="lab-validation" role="alert">{fileError}</p>}<div className="directory-entries">{singleFiles.map((file) => <div className="directory-entry directory-file" key={file}><span>▤</span><strong>{file}</strong><small>Root-level file <button type="button" className="lab-secondary" onClick={() => setSingleFiles((files) => files.filter((entry) => entry !== file))}>Remove</button></small></div>)}{!singleFiles.length && <p className="answer-placeholder">The directory is empty.</p>}</div></> : <>
    <div className="directory-breadcrumb">{ancestors.map((ancestor) => <button type="button" key={ancestor} className={path === ancestor ? "selected" : ""} onClick={() => setPath(ancestor)}>{ancestor === "/" ? "/" : ancestor.split("/").at(-1)}</button>)}</div>
    <div className="directory-current"><span className="eyebrow">CURRENT DIRECTORY</span><strong>{path}</strong></div>
    <div className="directory-entries">{current.directories.map((directory) => <button type="button" className="directory-entry directory-folder" key={directory} onClick={() => setPath(`${path === "/" ? "" : path}/${directory}`)}><span>▰</span><strong>{directory}/</strong><small>Open directory →</small></button>)}{current.files.map((file) => <div className="directory-entry directory-file" key={file}><span>▤</span><strong>{file}</strong><small>File entry · leaf node</small></div>)}{!current.directories.length && !current.files.length && <p className="answer-placeholder">This directory is empty.</p>}</div>
    <div className="how-it-works"><span className="eyebrow">PATH RESOLUTION</span><p>{path === "/" ? "Start at the root. Choose a child directory and follow the breadcrumb to inspect each path component." : `Each component of ${path} was looked up in its parent directory. Continue into a child or use the breadcrumb to go back.`}</p></div>
    </>}
  </section>;
}
