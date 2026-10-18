import { describe, expect, it, vi } from "vitest";
import { getWorld } from "workflow/runtime";
import { listInFlightCourseDetails } from "./course-details-runs";

// The operational run store is external; Prisma remains real in the owning core recovery tests.
vi.mock("workflow/runtime", () => ({ getWorld: vi.fn() }));

function mockRunList(list: ReturnType<typeof vi.fn>) {
  vi.mocked(getWorld).mockResolvedValue(
    // Only runs.list is used at this external boundary.
    { runs: { list } } as never,
  );
}

describe(listInFlightCourseDetails, () => {
  it("includes queued and running runs across pages, including legacy serialized inputs", async () => {
    const list = vi.fn().mockImplementation(({ status, pagination }) => {
      if (status === "pending" && !pagination.cursor) {
        return Promise.resolve({
          cursor: "more",
          data: [{ attributes: { courseId: "queued-course" } }],
          hasMore: true,
        });
      }

      if (status === "pending") {
        return Promise.resolve({
          data: [{ attributes: {}, input: [[1], { courseId: 2 }, "legacy-course"] }],
          hasMore: false,
        });
      }

      return Promise.resolve({
        data: [{ attributes: { courseId: "running-course" } }],
        hasMore: false,
      });
    });

    mockRunList(list);

    await expect(listInFlightCourseDetails()).resolves.toStrictEqual(
      new Set(["queued-course", "legacy-course", "running-course"]),
    );

    expect(list).toHaveBeenCalledTimes(3);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: "running" }));
  });

  it("fails closed when an active legacy run cannot be identified", async () => {
    mockRunList(
      vi
        .fn()
        .mockResolvedValue({
          data: [{ attributes: {}, input: new Uint8Array([101, 110, 99, 114]) }],
          hasMore: false,
        }),
    );

    await expect(listInFlightCourseDetails()).rejects.toThrow(
      "Cannot identify an active course-details run",
    );
  });

  it("propagates operational lookup failures rather than declaring work inactive", async () => {
    mockRunList(vi.fn().mockRejectedValue(new Error("run store unavailable")));
    await expect(listInFlightCourseDetails()).rejects.toThrow("run store unavailable");
  });
});
