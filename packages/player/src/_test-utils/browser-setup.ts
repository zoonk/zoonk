import "@zoonk/ui/globals.css";
import "@zoonk/ui/fun.css";
import "../questions/styles.css";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
