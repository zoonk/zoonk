import { type MockShape } from "../mock-contract";

export function mockPaperKey(paper: MockShape | string) {
  return typeof paper === "string" ? paper : JSON.stringify([paper.kind, paper.day, paper.area]);
}
