import { readFileSync } from "node:fs";

// The harness's address, from the port init wrote to studio.json.
const { port } = JSON.parse(readFileSync(new URL("../studio.json", import.meta.url), "utf8"));

export const HARNESS = `http://localhost:${port}`;
