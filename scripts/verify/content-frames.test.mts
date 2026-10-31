import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type MainFrame, contentFrameAt, countFlashes, shellWords } from "./content-frames.mts";

const SHELL_AT = 200;
const CONTENT_AT = 520;
const SETTLED_AT = 900;
const SETTLED_WORDS = 300;
const PAINT_AFTER_SHELL = 250;
const PAINT_BEFORE_SHELL = 100;

const LOAD: MainFrame[] = [
  { at: SHELL_AT, skeleton: true, words: 1 },
  { at: CONTENT_AT, skeleton: false, words: 290 },
  { at: SETTLED_AT, skeleton: false, words: SETTLED_WORDS },
];

describe(contentFrameAt, () => {
  it("is the first frame without a skeleton and with nearly all the settled words", () => {
    assert.equal(contentFrameAt(LOAD, 0), CONTENT_AT);
  });

  it("skips frames before the given time", () => {
    assert.equal(contentFrameAt(LOAD, CONTENT_AT + 1), SETTLED_AT);
  });

  it("is null when the page never settled on any words", () => {
    assert.equal(contentFrameAt([{ at: SHELL_AT, skeleton: true, words: 0 }], 0), null);
  });
});

describe(countFlashes, () => {
  it("counts content, then a skeleton, then content again", () => {
    const frames: MainFrame[] = [
      { at: 100, skeleton: false, words: SETTLED_WORDS },
      { at: 200, skeleton: true, words: 2 },
      { at: 300, skeleton: false, words: SETTLED_WORDS },
    ];

    assert.equal(countFlashes(frames, 0), 1);
  });

  it("counts a frame that lost most of its words", () => {
    const frames: MainFrame[] = [
      { at: 100, skeleton: false, words: SETTLED_WORDS },
      { at: 200, skeleton: false, words: 10 },
      { at: 300, skeleton: false, words: SETTLED_WORDS },
    ];

    assert.equal(countFlashes(frames, 0), 1);
  });

  it("doesn't count a skeleton before the content first showed", () => {
    assert.equal(countFlashes(LOAD, 0), 0);
  });
});

describe(shellWords, () => {
  it("reads the frame showing at the first paint", () => {
    assert.equal(shellWords(LOAD, PAINT_AFTER_SHELL), 1);
  });

  it("reads the first frame when the paint came before any", () => {
    assert.equal(shellWords(LOAD, PAINT_BEFORE_SHELL), 1);
  });

  it("is null without a first paint", () => {
    assert.equal(shellWords(LOAD, null), null);
  });
});
