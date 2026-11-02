import "./browser.css";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/** The browser keeps 250 resource entries; a test reads every module fetch to tell what loaded. */
const RESOURCE_ENTRIES = 10_000;

performance.setResourceTimingBufferSize(RESOURCE_ENTRIES);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
