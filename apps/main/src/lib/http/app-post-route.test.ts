import { describe, expect, it, vi } from "vitest";
import { appPostRoute } from "./app-post-route";

function request(origin = "http://localhost:9000") {
  return new Request("http://localhost:9000/api/app-post-test", {
    headers: { Host: "localhost:9000", Origin: origin },
    method: "POST",
  });
}

describe(appPostRoute, () => {
  it("answers with the screen's outcome as JSON", async () => {
    const post = appPostRoute("app-post-test", async () => ({ status: "updated" }));
    const response = await post(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ status: "updated" });
  });

  it("refuses a foreign origin without running the write", async () => {
    const write = vi.fn();
    const post = appPostRoute("app-post-test", write);

    const response = await post(request("https://foreign.example"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    expect(write).not.toHaveBeenCalled();
  });

  it("answers a failed write with a 500, which the screen treats as not sent", async () => {
    const post = appPostRoute("app-post-test", () => Promise.reject(new Error("Down")));
    const response = await post(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(500);
  });
});
