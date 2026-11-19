import test from "node:test";
import assert from "node:assert/strict";
import { quizzes, quizTopics } from "../src/quizQuestions.js";
import { challengeTopics, osChallenges } from "../src/challengeQuestions.js";
import {
  osFurtherReading,
  osReferenceSources,
  osStudyRoadmap,
  topicGlossary,
  topicTheory,
  theoryTopics,
  visualizationGuides,
} from "../src/theoryContent.js";
import {
  parseDeadlockDetectionInput,
  parseProcesses,
  simulateCpu,
  simulateDeadlockDetection,
  simulateDisk,
  simulateMemory,
  simulatePages,
  simulateTlb,
  translatePagedAddress,
  translateSegmentedAddress,
} from "../src/algorithms.js";

test("every learning topic has 20 distinct, valid quiz questions", () => {
  assert.equal(quizTopics.length, 12);
  for (const topic of quizTopics) {
    const questions = quizzes[topic];
    assert.equal(questions.length, 20, `${topic} should contain 20 questions`);
    assert.equal(new Set(questions.map((item) => item.question)).size, 20, `${topic} questions should be distinct`);
    assert.ok(questions.every((item) => item.options.length === 3
      && Number.isInteger(item.answer)
      && item.answer >= 0
      && item.answer < item.options.length
      && item.explanation.trim().length >= 30), `${topic} questions should have valid choices, answers, and meaningful explanations`);
    assert.ok(new Set(questions.map((item) => item.answer)).size > 1, `${topic} correct answers should not always use the same choice`);
  }
});

test("scenario challenges cover every learning topic with usable feedback", () => {
  assert.deepEqual([...new Set(challengeTopics)].sort(), [...quizTopics].sort());
  assert.equal(osChallenges.length, quizTopics.length);
  assert.equal(new Set(osChallenges.map(({ id }) => id)).size, osChallenges.length);
  for (const challenge of osChallenges) {
    assert.ok(challenge.title.length >= 8);
    assert.ok(challenge.scenario.length >= 50);
    assert.ok(challenge.hint.length >= 20);
    assert.ok(challenge.explanation.length >= 60);
    assert.equal(challenge.options.length, 3);
    assert.ok(Number.isInteger(challenge.answer));
    assert.ok(challenge.answer >= 0 && challenge.answer < challenge.options.length);
  }
});

test("every learning topic has a complete, topic-specific theory guide", () => {
  assert.deepEqual(theoryTopics, quizTopics);
  assert.equal(osFurtherReading.url, "https://www.geeksforgeeks.org/operating-systems/operating-systems/");
  assert.ok(osFurtherReading.label.includes("Operating System Tutorial"));
  for (const topic of theoryTopics) {
    const lesson = topicTheory[topic];
    assert.ok(lesson.overview.length >= 180, `${topic} should explain its scope`);
    assert.ok(lesson.simple.length >= 100, `${topic} should include a plain-language explanation`);
    assert.ok(lesson.analogy.length >= 100, `${topic} should include a bounded analogy`);
    assert.ok(lesson.realWorld.length >= 100, `${topic} should connect to operating-system use`);
    assert.equal(lesson.recap.length, 3, `${topic} should have a concise recap`);
    assert.ok(lesson.selfCheck.length >= 40 && lesson.selfCheckAnswer.length >= 60, `${topic} should include an answerable self-check`);
    assert.equal(lesson.objectives.length, 3, `${topic} should have learning objectives`);
    assert.ok(lesson.terms.length >= 5, `${topic} should define key vocabulary`);
    assert.ok(lesson.rules.length >= 3, `${topic} should provide core rules or formulas`);
    assert.ok(lesson.example.length >= 100, `${topic} should include a worked example`);
    assert.ok(lesson.steps.length >= 4, `${topic} should explain how to reason through it`);
    assert.ok(lesson.pitfalls.length >= 2, `${topic} should address common misconceptions`);
    assert.ok(lesson.connections.length >= 2, `${topic} should connect to other OS topics`);
    const glossary = topicGlossary[topic];
    assert.deepEqual(glossary.map(([term]) => term), lesson.terms, `${topic} should define every listed term`);
    assert.ok(glossary.every(([, definition]) => definition.length >= 35), `${topic} definitions should be meaningful`);
  }
});

test("the complete OS guide covers the subject and links to reputable references", () => {
  assert.ok(osStudyRoadmap.length >= 15, "the whole-OS roadmap should cover the major OS areas");
  assert.ok(osStudyRoadmap.every(([, explanation, relatedTopics]) => explanation.length >= 100
    && relatedTopics.length > 0
    && relatedTopics.every((topic) => theoryTopics.includes(topic))), "roadmap sections should explain concepts and link to existing lessons");
  assert.ok(osReferenceSources.length >= 5, "the guide should provide multiple independent learning references");
  assert.ok(osReferenceSources.every((source) => source.url.startsWith("https://")
    && source.description.length >= 50
    && source.topics.length > 0
    && source.topics.every((topic) => theoryTopics.includes(topic))), "references should be secure, described, and mapped to lessons");
});

test("every OS learning topic has a specific, bounded visualization guide", () => {
  assert.deepEqual(Object.keys(visualizationGuides).sort(), [...quizTopics].sort());
  for (const topic of quizTopics) {
    const guide = visualizationGuides[topic];
    assert.ok(guide.summary.length >= 70, `${topic} should explain what its visual demonstrates`);
    assert.ok(guide.focus.length >= 3, `${topic} should teach learners what to inspect`);
    assert.ok(guide.focus.every((item) => item.length >= 20), `${topic} visual focus points should be specific`);
    assert.ok(guide.scope.length >= 70, `${topic} should state important model boundaries`);
  }
});

test("non-preemptive priority does not interrupt the running process", () => {
  const input = "P1,0,4,2\nP2,1,1,1";
  const preemptive = simulateCpu(parseProcesses(input, "priority"), "priority");
  const nonPreemptive = simulateCpu(parseProcesses(input, "priority_np"), "priority_np");
  assert.equal(preemptive.events[1].pid, "P2");
  assert.equal(nonPreemptive.events[1].pid, "P1");
});

test("priority input is restricted to the documented 1–10 range", () => {
  assert.throws(() => parseProcesses("P1,0,1,0", "priority_np"), /priority must be between 1 and 10/);
  assert.throws(() => parseProcesses("P1,0,1,11", "priority"), /priority must be between 1 and 10/);
});

test("Next Fit resumes its circular search after the previous allocation", () => {
  const result = simulateMemory([100, 200, 300, 400], [250, 100, 150], "next_fit");
  assert.deepEqual(result.events.map((event) => event.block), ["B3", "B4", "B2"]);
});

test("First, Best, and Worst Fit use their documented block-selection rules", () => {
  const blocks = [100, 500, 200, 300, 600];
  assert.equal(simulateMemory(blocks, [212], "first_fit").events[0].block, "B2");
  assert.equal(simulateMemory(blocks, [212], "best_fit").events[0].block, "B4");
  assert.equal(simulateMemory(blocks, [212], "worst_fit").events[0].block, "B5");
});

test("Optimal page replacement evicts the page used farthest in the future", () => {
  const result = simulatePages([1, 2, 3, 1, 4, 2, 1], 3, "optimal");
  assert.equal(result.events[4].evicted, 3);
  assert.equal(result.events[4].faults, 4);
});

test("Second Chance clears reference bits before replacing the first eligible frame", () => {
  const result = simulatePages([1, 2, 3, 1, 4], 3, "second_chance");
  assert.equal(result.events.at(-1).evicted, 1);
  assert.deepEqual(result.events.at(-1).referenced, [true, false, false]);
  assert.equal(result.faults, 4);
});

test("deadlock detection reports processes blocked in a resource cycle", () => {
  const allocation = [[1, 0], [0, 1]];
  const request = [[0, 1], [1, 0]];
  const result = simulateDeadlockDetection(allocation, request, [0, 0]);
  assert.equal(result.safe, false);
  assert.deepEqual(result.deadlocked, ["P0", "P1"]);
  assert.equal(result.events.length, 0);
});

test("deadlock detection advances when a request fits and a process releases resources", () => {
  const result = simulateDeadlockDetection([[1, 0], [0, 1]], [[0, 0], [1, 0]], [0, 0]);
  assert.equal(result.safe, true);
  assert.deepEqual(result.sequence, ["P0", "P1"]);
  assert.deepEqual(result.availableAfter, [1, 1]);
});

test("deadlock input rejects a request larger than the system resource total", () => {
  assert.throws(
    () => parseDeadlockDetectionInput("1 0", "3 0", "0 0"),
    /cannot exceed the total number of instances/,
  );
});

test("TLB simulation distinguishes hits, page-table misses, and page faults", () => {
  const result = simulateTlb([0, 1, 0, 2], 2, 2);
  assert.deepEqual(result.events.map((event) => [event.tlbHit, event.pageFault]), [
    [false, true],
    [false, true],
    [true, false],
    [false, true],
  ]);
  assert.equal(result.events[3].evicted, 0);
  assert.equal(result.faults, 3);
  assert.equal(result.tlbHits, 1);
});

test("paging translates configurable page tables and rejects unmapped pages", () => {
  assert.deepEqual(translatePagedAddress(3456, 1024, [2, 5, 1, 4]), {
    page: 3,
    offset: 384,
    frame: 4,
    physical: 4480,
    pageSize: 1024,
  });
  assert.throws(() => translatePagedAddress(4096, 1024, [2, 5, 1, 4]), /page 4 is not mapped/);
  assert.throws(() => translatePagedAddress(0, 0, [1]), /Page size must be/);
});

test("segmentation checks configured bounds before calculating physical addresses", () => {
  assert.deepEqual(translateSegmentedAddress(511, { name: "Stack", base: 12000, limit: 512 }), {
    segment: "Stack",
    base: 12000,
    limit: 512,
    offset: 511,
    physical: 12511,
  });
  assert.throws(() => translateSegmentedAddress(512, { name: "Stack", base: 12000, limit: 512 }), /exceeds the Stack segment limit/);
  assert.throws(() => translateSegmentedAddress(0, { name: "Code", base: -1, limit: 10 }), /Segment base must be/);
});

test("SCAN sequence and movement include the physical boundary", () => {
  const result = simulateDisk([10, 90], 50, 100, "scan", "up");
  assert.deepEqual(result.sequence, [50, 90, 99, 10]);
  assert.equal(result.totalSeek, 138);
});

test("SSTF keeps input order for equal-distance requests", () => {
  const result = simulateDisk([10, 30], 20, 100, "sstf");
  assert.deepEqual(result.sequence, [20, 10, 30]);
});
