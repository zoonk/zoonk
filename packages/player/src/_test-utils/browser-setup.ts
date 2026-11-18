import "./browser.css";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

/** The browser keeps 250 resource entries; a test reads every module fetch to tell what loaded. */
const RESOURCE_ENTRIES = 10_000;

performance.setResourceTimingBufferSize(RESOURCE_ENTRIES);

beforeAll(async () => {
  const fonts = await Promise.all([
    document.fonts.load('16px "Geist"'),
    document.fonts.load('16px "Geist Mono"'),
  ]);

  if (fonts.some((faces) => faces.length === 0)) {
    throw new Error("The player browser tests could not load the bundled Geist fonts.");
  }
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
