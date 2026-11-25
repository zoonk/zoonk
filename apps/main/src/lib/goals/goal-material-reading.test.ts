import { describe, expect, it, vi } from "vitest";
import { askMaterialQuestion } from "./goal-material-questions";
import { attachGoalText, readUploadStatus } from "./goal-uploads";
import { answerUploadRequest } from "./research-uploads";

const api = vi.hoisted(() => ({ response: new Response() }));

vi.mock(import("../api/browser-api"), () => ({
  getFromBrowser: async () => api.response,
  postFromBrowser: async () => api.response,
}));

function respond(body: unknown, status = 200) {
  api.response = Response.json(body, { status });
}

describe("material that's still being read, or that has nothing to read", () => {
  it("attaches an upload with how far its reading got", async () => {
    respond({ source: { id: "s1", readStatus: "reading", title: "Notes.jpg" } }, 201);

    await expect(attachGoalText({ language: "en", text: "My notes" })).resolves.toStrictEqual({
      source: { id: "s1", readStatus: "reading", title: "Notes.jpg" },
      status: "attached",
    });
  });

  it("reads an upload's status again, and nothing when it's gone", async () => {
    respond({ id: "s1", readStatus: "unreadable", title: "Notes.jpg" });
    await expect(readUploadStatus("s1")).resolves.toBe("unreadable");

    respond({ error: { code: "NOT_FOUND", message: "Source not found" } }, 404);
    await expect(readUploadStatus("s1")).resolves.toBeNull();
  });

  it("keeps a question about material that's still being read for later", async () => {
    respond({ error: { code: "MATERIAL_READING", message: "Still reading" } }, 409);

    await expect(
      askMaterialQuestion({ language: "en", question: "Why?", sourceIds: ["s1"] }),
    ).resolves.toStrictEqual({ status: "reading" });
  });

  it("keeps the upload request open for an upload with nothing to read", async () => {
    respond({ error: { code: "UPLOAD_UNREADABLE", message: "Nothing to read" } }, 422);

    await expect(answerUploadRequest({ goalId: "g1", sourceIds: ["s1"] })).resolves.toBe(
      "unreadable",
    );
  });
});
