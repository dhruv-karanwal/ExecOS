// ExecOS · Memory Management Techniques · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 160-167
//   frontend/src/AlgorithmStudio.jsx lines 244-249
//   frontend/src/AlgorithmStudio.jsx lines 310-315
//   frontend/src/AlgorithmStudio.jsx lines 920-925
//   frontend/src/AlgorithmStudio.jsx lines 927-1047
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const descriptions = {
  "Memory Management Techniques": {
    purpose: "Memory management techniques organize address spaces, translate virtual addresses, allocate physical frames, and enforce process isolation.",
    example: "Paging divides virtual memory into pages and physical RAM into equal-sized frames; a page table connects the two.",
    pseudocode: "choose an address-space model\ntranslate virtual address\ncheck permissions and bounds\nresolve page fault if not resident",
    advantages: "Compare contiguous allocation, paging, segmentation, and virtual memory in one visual map.",
    disadvantages: "The overview is conceptual; detailed allocations and page replacement are available in their dedicated interactive labs.",
    complexity: "O(1) illustrative translation", space: "Model-dependent",
  },
};

const deepTheory = {
  "Memory Management Techniques": [
    ["Fixed and variable partitions", "MFT divides memory into a fixed set of partitions; each allocated process occupies a whole partition, so unused space inside it is internal fragmentation. MVT creates variable-sized regions as processes arrive, improving fit but leaving external holes when processes exit. The labs show both layouts, releases, and compaction."],
    ["Contiguous allocation", "A process receives one continuous physical region. It is simple and makes address translation easy, but free space can become externally fragmented and a process may require compaction or a larger contiguous region."],
    ["Paging", "Paging splits virtual address spaces into fixed-size pages and physical memory into same-size frames. A page table maps pages to frames, allowing a process's pages to be physically non-contiguous. It avoids external fragmentation at the cost of page tables and possible internal waste in the last page."],
    ["Segmentation and virtual memory", "Segmentation divides an address space into variable-sized logical regions with independent base and limit values. Virtual memory lets processes use protected address spaces larger than available physical RAM by keeping some pages nonresident and loading them on demand. Systems can combine segmentation concepts with paging."],
  ],
};

const legacyQuizFallback = {
  "Memory Management Techniques": [
    { question: "What does paging map?", options: ["Virtual pages to physical frames", "Files to directory paths", "Processes to CPU time slices"], answer: 0, explanation: "A page table maps a virtual page number to a physical frame." },
    { question: "Which technique uses variable-sized logical regions with base and limit?", options: ["Segmentation", "Paging", "Round Robin"], answer: 0, explanation: "A segment descriptor identifies a region's base and valid offset limit." },
    { question: "What kind of fragmentation does paging avoid?", options: ["External fragmentation", "Every form of memory waste", "Internal fragmentation"], answer: 0, explanation: "Fixed-size frames avoid external holes, although partial pages can still cause internal waste." },
    { question: "What is characteristic of MFT?", options: ["Fixed partitions can leave internal fragmentation", "Every process gets page-table frames", "No memory partition exists"], answer: 0, explanation: "A process in a fixed partition may leave unusable slack inside its assigned partition." },
  ],
};

const memoryTechniques = [
  { id: "contiguous", title: "Contiguous allocation", section: "Memory", detail: "One adjacent region per process.", strengths: "Simple address calculation", tradeoff: "External fragmentation", visual: ["PROCESS", "CONTIGUOUS BLOCK", "FREE REGION"], explanation: "The process occupies one continuous physical region. A fitting request needs a sufficiently large free block." },
  { id: "paging", title: "Paging", section: "Storage", detail: "Fixed-size pages map to frames.", strengths: "No external fragmentation", tradeoff: "Page-table overhead", visual: ["VIRTUAL PAGE", "PAGE TABLE", "PHYSICAL FRAME"], explanation: "A page table can map virtual pages to any available physical frames, so a process need not be contiguous in RAM." },
  { id: "segmentation", title: "Segmentation", section: "Storage", detail: "Variable-size logical regions.", strengths: "Matches logical program units", tradeoff: "External fragmentation", visual: ["SEGMENT + OFFSET", "BASE / LIMIT CHECK", "PHYSICAL ADDRESS"], explanation: "A segment table gives each logical region a base and bound; the OS checks the offset before translation." },
  { id: "virtual", title: "Virtual memory", section: "Storage", detail: "Demand-load pages into RAM.", strengths: "Isolation and larger address spaces", tradeoff: "Page-fault latency", visual: ["VIRTUAL ADDRESS", "RESIDENT? · PAGE TABLE", "FRAME OR PAGE FAULT"], explanation: "The process sees a virtual address space; a missing page is brought in on demand and may require replacement." },
];

function MemoryTechniqueLab({ onOpenModule }) {
  const [selected, setSelected] = useState(memoryTechniques[0]);
  const [lab, setLab] = useState("overview");
  const [fixedPartitionInput, setFixedPartitionInput] = useState("100, 200, 300, 400");
  const [fixedRequestInput, setFixedRequestInput] = useState("80, 150, 250, 500");
  const [fixedSizes, setFixedSizes] = useState([100, 200, 300, 400]);
  const [fixedRequests, setFixedRequests] = useState([80, 150, 250, 500]);
  const [fixedError, setFixedError] = useState("");
  const [fixedPartitions, setFixedPartitions] = useState([100, 200, 300, 400].map((size) => ({ size, process: null })));
  const [fixedIndex, setFixedIndex] = useState(0);
  const [fixedMessage, setFixedMessage] = useState("Click Next to place a process into the first available partition that can hold it.");
  const [variableBlocks, setVariableBlocks] = useState([{ size: 1000, process: null }]);
  const [variableIndex, setVariableIndex] = useState(0);
  const [variableMessage, setVariableMessage] = useState("Allocate, release, and compact regions to observe external fragmentation.");
  const [variableCapacityInput, setVariableCapacityInput] = useState("1000");
  const [variableRequestInput, setVariableRequestInput] = useState("220, 350, 180, 300");
  const [variableCapacity, setVariableCapacity] = useState(1000);
  const [variableRequests, setVariableRequests] = useState([220, 350, 180, 300]);
  const [variableError, setVariableError] = useState("");
  const configureFixed = () => {
    try {
      const sizes = parseIntegerList(fixedPartitionInput, "Partition sizes", { min: 1, maxItems: 20 });
      const requests = parseIntegerList(fixedRequestInput, "Process sizes", { min: 1, maxItems: 100 });
      if (sizes.reduce((sum, size) => sum + size, 0) > 1000000) throw new Error("Total partition size cannot exceed 1,000,000 units.");
      setFixedSizes(sizes);
      setFixedRequests(requests);
      setFixedPartitions(sizes.map((size) => ({ size, process: null })));
      setFixedIndex(0);
      setFixedMessage("Workload applied. Allocate each process to the first available partition that can hold it.");
      setFixedError("");
    } catch (error) {
      setFixedError(error.message);
    }
  };
  const configureVariable = () => {
    try {
      const capacity = Number(variableCapacityInput);
      if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000000) {
        throw new Error("Memory capacity must be a whole number between 1 and 1,000,000 units.");
      }
      const requests = parseIntegerList(variableRequestInput, "Process sizes", { min: 1, maxItems: 100 });
      setVariableCapacity(capacity);
      setVariableRequests(requests);
      setVariableBlocks([{ size: capacity, process: null }]);
      setVariableIndex(0);
      setVariableMessage("Workload applied. Allocate, release, and compact regions to observe external fragmentation.");
      setVariableError("");
    } catch (error) {
      setVariableError(error.message);
    }
  };
  const allocateFixed = () => {
    const size = fixedRequests[fixedIndex];
    if (size === undefined) return;
    const target = fixedPartitions.findIndex((partition) => !partition.process && partition.size >= size);
    if (target >= 0) {
      const partition = fixedPartitions[target];
      setFixedPartitions((blocks) => blocks.map((block, index) => index === target ? { ...block, process: { id: `P${fixedIndex + 1}`, size } } : block));
      setFixedMessage(`P${fixedIndex + 1} (${size}) occupies the ${partition.size}-unit partition; ${partition.size - size} units are internal fragmentation.`);
    } else {
      setFixedMessage(`P${fixedIndex + 1} (${size}) cannot fit in any remaining fixed partition. Free and internally wasted space cannot be combined into one partition.`);
    }
    setFixedIndex((index) => index + 1);
  };
  const allocateVariable = () => {
    const size = variableRequests[variableIndex];
    if (size === undefined) return;
    const target = variableBlocks.findIndex((block) => !block.process && block.size >= size);
    if (target >= 0) {
      const block = variableBlocks[target];
      const next = variableBlocks.slice();
      next.splice(target, 1, { size, process: { id: `P${variableIndex + 1}`, size } }, ...(block.size > size ? [{ size: block.size - size, process: null }] : []));
      setVariableBlocks(next);
      setVariableMessage(`P${variableIndex + 1} is placed in a ${block.size}-unit free region, leaving ${block.size - size} free units adjacent to it.`);
    } else {
      const free = variableBlocks.filter((block) => !block.process);
      const freeTotal = free.reduce((sum, block) => sum + block.size, 0);
      const largest = Math.max(0, ...free.map((block) => block.size));
      setVariableMessage(`P${variableIndex + 1} (${size}) cannot fit: ${freeTotal} units are free in total, but the largest contiguous hole is ${largest}.`);
    }
    setVariableIndex((index) => index + 1);
  };
  const releaseVariable = (index) => {
    const next = variableBlocks.map((block, position) => position === index ? { size: block.size, process: null } : { ...block });
    for (let position = 0; position < next.length - 1;) {
      if (!next[position].process && !next[position + 1].process) {
        next.splice(position, 2, { size: next[position].size + next[position + 1].size, process: null });
      } else position += 1;
    }
    setVariableBlocks(next);
    setVariableMessage("The process was released. Adjacent free regions were coalesced; separated holes remain fragmented.");
  };
  const compactVariable = () => {
    const allocated = variableBlocks.filter((block) => block.process);
    const occupied = allocated.reduce((sum, block) => sum + block.size, 0);
    setVariableBlocks([...allocated, ...(occupied < variableCapacity ? [{ size: variableCapacity - occupied, process: null }] : [])]);
    setVariableMessage("Compaction moved allocated regions together and combined all free space into one contiguous hole.");
  };
  const renderBlocks = (blocks, fixed = false) => <div className="memory-visual" aria-label={fixed ? "Fixed memory partitions" : "Variable memory partitions"}>{blocks.map((block, index) => <div className={`memory-visual-block ${block.process ? "" : "free"}`} style={{ flexGrow: block.size }} key={`${index}-${block.size}`} title={`${block.process ? `${block.process.id} ${block.process.size} units` : "Free"} · region ${block.size}`}><strong>{block.process ? block.process.id : "FREE"}</strong><small>{block.process ? `${block.process.size} used / ${block.size} total` : `${block.size} units free`}</small>{fixed && block.process && <i style={{ flexGrow: Math.max(0, block.size - block.process.size) }}><small>{block.size - block.process.size} internal waste</small></i>}{!fixed && block.process && <button type="button" className="lab-secondary" onClick={() => releaseVariable(index)}>Release {block.process.id}</button>}</div>)}</div>;
  return <div className="concept-lab memory-technique-lab">
    <section className="lab-panel">
    <div className="lab-panel-heading"><div><span className="eyebrow">MEMORY MANAGEMENT OVERVIEW</span><h3>Compare the address-space techniques</h3></div><span>CONCEPT MAP</span></div>
    <div className="translation-tabs" role="group" aria-label="Memory management lab">{[["overview", "Concept overview"], ["mft", "MFT fixed partitions"], ["mvt", "MVT variable partitions"]].map(([key, label]) => <button type="button" className={lab === key ? "selected" : ""} aria-pressed={lab === key} key={key} onClick={() => setLab(key)}>{label}</button>)}</div>
    {lab === "overview" && <>
    <div className="memory-technique-picker" role="group" aria-label="Choose memory technique">{memoryTechniques.map((technique) => <button type="button" className={selected.id === technique.id ? "selected" : ""} aria-pressed={selected.id === technique.id} key={technique.id} onClick={() => setSelected(technique)}>{technique.title}</button>)}</div>
    <div className="memory-technique-flow">{selected.visual.map((item, index) => <div className={`memory-technique-node ${index === 1 ? "focus" : ""}`} key={item}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item}</strong></div>)}</div>
    <p className="memory-technique-detail">{selected.detail} {selected.explanation}</p>
    <div className="memory-technique-facts"><span><small>STRENGTH</small><strong>{selected.strengths}</strong></span><span><small>TRADEOFF</small><strong>{selected.tradeoff}</strong></span></div>
    <button type="button" className="lab-secondary" onClick={() => onOpenModule(selected.section)}>Open {selected.section} simulation ↗</button>
    </>}
    {lab === "mft" && <div className="memory-technique-simulation">
      <div className="translation-controls"><label>Fixed partition sizes<input value={fixedPartitionInput} onChange={(event) => setFixedPartitionInput(event.target.value)} /><small>Positive whole numbers, comma separated</small></label><label>Process sizes<input value={fixedRequestInput} onChange={(event) => setFixedRequestInput(event.target.value)} /><small>Each process needs one whole partition</small></label><button type="button" className="lab-secondary" onClick={configureFixed}>Apply workload</button></div>
      {fixedError && <p className="lab-validation" role="alert">{fixedError}</p>}
      <div className="how-it-works"><span className="eyebrow">MULTIPROGRAMMING WITH A FIXED NUMBER OF TASKS / PARTITIONS</span><p>Partitions are created with fixed sizes. Each process takes one whole partition, so unused space inside it is internal fragmentation. Current requests: {fixedRequests.join(", ")} units.</p><span className="eyebrow">ALLOCATION DECISION</span><p>{fixedMessage}</p></div>{renderBlocks(fixedPartitions, true)}<div className="step-controls"><button type="button" className="lab-primary" onClick={allocateFixed} disabled={fixedError !== "" || fixedIndex >= fixedRequests.length}>Allocate P{fixedIndex + 1} · {fixedRequests[fixedIndex] ?? "complete"}</button><button type="button" className="lab-secondary" onClick={() => { setFixedPartitions(fixedSizes.map((size) => ({ size, process: null }))); setFixedIndex(0); setFixedMessage("Fixed-partition run reset."); }}>Reset run</button><span className="step-counter">{fixedIndex} / {fixedRequests.length} requests processed</span></div><p className="lab-note">MFT can reject a process even if total unused space is large: each request must fit one free partition.</p></div>}
    {lab === "mvt" && <div className="memory-technique-simulation">
      <div className="translation-controls"><label>Total memory capacity<input type="number" min="1" max="1000000" value={variableCapacityInput} onChange={(event) => setVariableCapacityInput(event.target.value)} /></label><label>Process sizes<input value={variableRequestInput} onChange={(event) => setVariableRequestInput(event.target.value)} /><small>Positive whole numbers, comma separated</small></label><button type="button" className="lab-secondary" onClick={configureVariable}>Apply workload</button></div>
      {variableError && <p className="lab-validation" role="alert">{variableError}</p>}
      <div className="how-it-works"><span className="eyebrow">MULTIPROGRAMMING WITH A VARIABLE NUMBER OF TASKS / PARTITIONS</span><p>Each process gets a region sized to its request. Release processes to create external holes, then compare total free memory with the largest contiguous hole. Capacity: {variableCapacity} units; requests: {variableRequests.join(", ")} units.</p><span className="eyebrow">ALLOCATION DECISION</span><p>{variableMessage}</p></div>{renderBlocks(variableBlocks)}<div className="step-controls"><button type="button" className="lab-primary" onClick={allocateVariable} disabled={variableError !== "" || variableIndex >= variableRequests.length}>Allocate P{variableIndex + 1} · {variableRequests[variableIndex] ?? "complete"}</button><button type="button" className="lab-secondary" onClick={compactVariable}>Compact free space</button><button type="button" className="lab-secondary" onClick={() => { setVariableBlocks([{ size: variableCapacity, process: null }]); setVariableIndex(0); setVariableMessage("Variable-partition run reset."); }}>Reset run</button><span className="step-counter">{variableIndex} / {variableRequests.length} requests processed</span></div></div>}
    </section>
  </div>;
}
