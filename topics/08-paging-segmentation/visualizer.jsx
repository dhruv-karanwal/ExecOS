// ExecOS · Paging & Segmentation · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 200-207
//   frontend/src/AlgorithmStudio.jsx lines 270-275
//   frontend/src/AlgorithmStudio.jsx lines 339-344
//   frontend/src/AlgorithmStudio.jsx lines 1165-1250
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const descriptions = {
  "Paging & Segmentation": {
    purpose: "Paging translates fixed-size virtual pages through a page table; segmentation translates logical segment offsets against a base and bounds.",
    example: "For page size 1024, address 3456 is page 3 plus offset 384; the page table supplies its physical frame.",
    pseudocode: "Paging:\n  page = address / page_size\n  offset = address % page_size\n  physical = frame[page] * page_size + offset\n\nSegmentation:\n  require offset < segment.limit\n  physical = segment.base + offset",
    advantages: "Interactive address translation shows page/frame mapping and segment bounds checking.",
    disadvantages: "This small address-space model does not emulate hardware TLBs, multi-level page tables, or full protection bits.",
    complexity: "O(1) lookup in the shown tables", space: "O(P + S)",
  },
};

const deepTheory = {
  "Paging & Segmentation": [
    ["Paging translation", "A virtual address splits into a page number and an offset. The page number indexes a process page table, which supplies a physical frame number; the offset is unchanged. For page size S, page = floor(address / S), offset = address mod S, and physical address = frame × S + offset. A missing page-table entry triggers a page fault rather than a valid physical translation."],
    ["TLB lookup and page faults", "A translation lookaside buffer caches recent page-to-frame translations. A TLB hit avoids the page-table memory access; a miss checks the page table. If the page is not resident, a page fault lets the OS load it into a frame, possibly evicting another page and invalidating its old TLB entry. The interactive lab steps through this lookup path with a bounded TLB and FIFO demand paging."],
    ["Segmentation translation", "A segmented logical address identifies a segment and an offset. Each segment descriptor supplies a base and limit. The offset must be less than the segment limit; otherwise the access is invalid. A valid physical address is base + offset. Segments correspond to logical units such as code, stack, or data and can have distinct permissions."],
    ["Compare the schemes", "Paging avoids external fragmentation by allocating fixed-size frames but can waste space in a final partially filled page. Segmentation matches variable-sized logical regions but can leave external holes. Systems can combine the two: segments provide a logical view while each segment is paged into frames."],
  ],
};

const legacyQuizFallback = {
  "Paging & Segmentation": [
    { question: "What stays the same when a virtual page maps to a physical frame?", options: ["The page offset", "The page number", "The process ID"], answer: 0, explanation: "Paging replaces the virtual page number with a frame number; the offset is preserved." },
    { question: "What does a segment limit protect?", options: ["The valid offset range for a segment", "The disk head direction", "The CPU quantum"], answer: 0, explanation: "An offset outside the segment limit is invalid and must not translate." },
    { question: "What does a missing page-table entry normally cause?", options: ["A page fault", "A context switch every time", "A directory lookup"], answer: 0, explanation: "The OS handles the nonresident mapping through a page fault." },
    { question: "What does a TLB hit avoid?", options: ["A page-table lookup", "The need for physical memory", "All permission checks"], answer: 0, explanation: "A TLB hit supplies the cached page-to-frame mapping without a page-table memory access." },
  ],
};

function AddressTranslationLab() {
  const [mode, setMode] = useState("paging");
  const [address, setAddress] = useState("3456");
  const [segment, setSegment] = useState("1");
  const [pageSizeInput, setPageSizeInput] = useState("1024");
  const [pageTableInput, setPageTableInput] = useState("2, 5, 1, 4");
  const [segments, setSegments] = useState([
    { name: "Code", base: "4000", limit: "600" },
    { name: "Data", base: "8000", limit: "900" },
    { name: "Stack", base: "12000", limit: "512" },
  ]);
  const [references, setReferences] = useState("0, 1, 0, 2, 3, 0, 1");
  const [frameCount, setFrameCount] = useState("3");
  const [tlbCapacity, setTlbCapacity] = useState("2");
  const [tlbStep, setTlbStep] = useState(0);
  const [tlbPlaying, setTlbPlaying] = useState(false);
  const tlbResult = useMemo(() => {
    try {
      const pages = parseIntegerList(references, "TLB page references", { maxItems: 100 });
      return { value: simulateTlb(pages, Number(frameCount), Number(tlbCapacity)), error: "" };
    } catch (error) {
      return { value: null, error: error.message };
    }
  }, [frameCount, references, tlbCapacity]);
  const tlbEvents = tlbResult.value?.events || [];
  const activeTlbEvent = tlbEvents[Math.max(0, tlbStep - 1)];
  const pageTable = useMemo(() => {
    try {
      return { frames: parseIntegerList(pageTableInput, "Page table", { maxItems: 256 }), error: "" };
    } catch (error) {
      return { frames: [], error: error.message };
    }
  }, [pageTableInput]);
  useEffect(() => {
    if (!tlbPlaying) return undefined;
    if (tlbStep >= tlbEvents.length) {
      setTlbPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setTlbStep((count) => count + 1), 700);
    return () => window.clearTimeout(timer);
  }, [tlbEvents.length, tlbPlaying, tlbStep]);
  const value = Number(address);
  const valid = Number.isSafeInteger(value) && value >= 0;
  const pageSize = Number(pageSizeInput);
  let translation;
  if (!valid) {
    translation = { error: "Enter a non-negative whole-number address." };
  } else if (mode === "paging") {
    try {
      if (pageTable.error) throw new Error(pageTable.error);
      translation = translatePagedAddress(value, pageSize, pageTable.frames);
    } catch (error) {
      translation = { error: error.message };
    }
  } else if (mode === "segmentation") {
    const selected = segments[Number(segment)];
    try {
      translation = translateSegmentedAddress(value, {
        ...selected,
        base: String(selected?.base ?? "").trim() ? Number(selected.base) : NaN,
        limit: String(selected?.limit ?? "").trim() ? Number(selected.limit) : NaN,
      });
    } catch (error) {
      translation = { error: error.message };
    }
  }
  return <section className="lab-panel address-lab">
    <div className="lab-panel-heading"><div><span className="eyebrow">ADDRESS TRANSLATION</span><h3>Paging, segmentation & TLB</h3></div><span>INPUT-DRIVEN DEMO</span></div>
    <div className="translation-tabs" role="group" aria-label="Address translation mode"><button type="button" className={mode === "paging" ? "selected" : ""} aria-pressed={mode === "paging"} onClick={() => setMode("paging")}>Paging</button><button type="button" className={mode === "segmentation" ? "selected" : ""} aria-pressed={mode === "segmentation"} onClick={() => setMode("segmentation")}>Segmentation</button><button type="button" className={mode === "tlb" ? "selected" : ""} aria-pressed={mode === "tlb"} onClick={() => setMode("tlb")}>TLB & page faults</button></div>
    {mode === "tlb" ? <>
      <div className="translation-controls"><label>Page-reference string<input value={references} onChange={(event) => { setReferences(event.target.value); setTlbStep(0); setTlbPlaying(false); }} /><small>Non-negative page numbers, comma separated</small></label><label>Physical frames<input type="number" min="1" max="32" value={frameCount} onChange={(event) => { setFrameCount(event.target.value); setTlbStep(0); setTlbPlaying(false); }} /></label><label>TLB entries<input type="number" min="1" max="16" value={tlbCapacity} onChange={(event) => { setTlbCapacity(event.target.value); setTlbStep(0); setTlbPlaying(false); }} /></label></div>
      {tlbResult.error ? <p className="translation-error" role="alert">{tlbResult.error}</p> : <>
        <div className="how-it-works"><span className="eyebrow">PAGE TABLE + TLB WALK · {tlbStep} / {tlbEvents.length}</span><p>{activeTlbEvent?.explanation || "Advance one reference to check the TLB, consult the page table, and resolve a page fault if needed."}</p></div>
        <div className="translation-map"><span>PHYSICAL FRAMES · FIFO DEMAND PAGING</span>{Array.from({ length: Number(frameCount) }, (_, index) => <div className={`translation-cell ${activeTlbEvent?.frameIndex === index ? "active" : ""}`} key={index}><small>FRAME {index}</small><b>{activeTlbEvent?.frames[index] ?? "EMPTY"}</b></div>)}</div>
        <div className="translation-map"><span>TLB · MOST RECENT FIRST</span>{Array.from({ length: Number(tlbCapacity) }, (_, index) => <div className="translation-cell" key={index}><small>ENTRY {index + 1}</small><b>{activeTlbEvent?.tlb[index] ? `PAGE ${activeTlbEvent.tlb[index].page} → FRAME ${activeTlbEvent.tlb[index].frame}` : "EMPTY"}</b></div>)}</div>
        {activeTlbEvent && <div className="translation-result"><span>REFERENCE {activeTlbEvent.index + 1} · PAGE {activeTlbEvent.page} · {activeTlbEvent.tlbHit ? "TLB HIT" : "TLB MISS"} · {activeTlbEvent.pageFault ? "PAGE FAULT" : "PAGE RESIDENT"}</span><strong>FRAME {activeTlbEvent.frameIndex} · {activeTlbEvent.faults} cumulative faults · {activeTlbEvent.tlbHits} TLB hits</strong></div>}
        <div className="step-controls"><button type="button" className="lab-primary" disabled={tlbPlaying || !tlbEvents.length} onClick={() => { if (tlbStep >= tlbEvents.length) setTlbStep(0); setTlbPlaying(true); }}>{tlbStep >= tlbEvents.length ? "↻ Replay" : "▶ Start"}</button><button type="button" className="lab-secondary" disabled={!tlbPlaying} onClick={() => setTlbPlaying(false)}>Ⅱ Pause</button><button type="button" className="lab-secondary" disabled={tlbPlaying || tlbStep === 0} onClick={() => setTlbStep((count) => Math.max(0, count - 1))}>← Previous</button><button type="button" className="lab-secondary" disabled={tlbPlaying || tlbStep >= tlbEvents.length} onClick={() => setTlbStep((count) => count + 1)}>⏭ Next</button><button type="button" className="lab-secondary" onClick={() => { setTlbPlaying(false); setTlbStep(0); }}>↻ Reset</button></div>
      </>}
    </> : <>
    <div className="translation-controls"><label>{mode === "paging" ? "Virtual address" : "Segment offset"}<input type="number" min="0" value={address} onChange={(event) => setAddress(event.target.value)} /></label>{mode === "paging" ? <><label>Page size<input type="number" min="1" max="1000000" value={pageSizeInput} onChange={(event) => setPageSizeInput(event.target.value)} /></label><label>Page table · frame per page<input value={pageTableInput} onChange={(event) => setPageTableInput(event.target.value)} /><small>Non-negative frame numbers, comma separated</small></label></> : <><label>Segment<select value={segment} onChange={(event) => setSegment(event.target.value)}>{segments.map((item, index) => <option value={index} key={item.name}>{item.name}</option>)}</select></label><label>Segment base<input type="number" min="0" value={segments[Number(segment)]?.base ?? ""} onChange={(event) => setSegments((current) => current.map((item, index) => index === Number(segment) ? { ...item, base: event.target.value } : item))} /></label><label>Segment limit<input type="number" min="1" value={segments[Number(segment)]?.limit ?? ""} onChange={(event) => setSegments((current) => current.map((item, index) => index === Number(segment) ? { ...item, limit: event.target.value } : item))} /></label></>}</div>
    {mode === "paging" ? <div className="translation-map"><span>Virtual pages · configured page table</span>{pageTable.frames.map((frame, page) => <div className={`translation-cell ${translation.page === page && !translation.error ? "active" : ""}`} key={page}><small>PAGE {page}</small><b>→ FRAME {frame}</b></div>)}</div> : <div className="translation-map"><span>Segment table</span>{segments.map(({ name, base, limit }, index) => <div className={`translation-cell ${segment === String(index) ? "active" : ""}`} key={name}><small>{name.toUpperCase()} · BASE {base}</small><b>LIMIT {limit}</b></div>)}</div>}
    {translation.error ? <p className="translation-error" role="status">{translation.error}</p> : <div className="translation-result"><span>{mode === "paging" ? `PAGE ${translation.page} × ${translation.pageSize} + OFFSET ${translation.offset}` : `${translation.segment} BASE ${translation.base} + OFFSET ${translation.offset}`}</span><strong>PHYSICAL ADDRESS · {translation.physical}</strong></div>}
    </>}
  </section>;
}
