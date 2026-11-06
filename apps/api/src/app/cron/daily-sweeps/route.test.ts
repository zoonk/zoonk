import { dailySweepsWorkflow } from "@/workflows/sweeps/daily-sweeps-workflow";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { POST as deliverScheduledRun } from "./route";

function deliver(headers: Record<string, string>) {
  return deliverScheduledRun(
    new Request("http://localhost/cron/daily-sweeps", { headers, method: "POST" }),
  );
}

describe("POST /cron/daily-sweeps", () => {
  it("starts the sweep for the scheduled run Vercel delivered", async () => {
    vi.mocked(start).mockResolvedValue({ runId: "wrun_sweeps" } as Awaited<
      ReturnType<typeof start>
    >);

    const response = await deliver({
      "ce-id": "execution-1",
      "ce-type": "com.vercel.schedule.v1beta",
    });

    expect(response.status).toBe(202);
    expect(start).toHaveBeenCalledWith(dailySweepsWorkflow, [{ executionId: "execution-1" }]);
  });

  it("starts nothing for a request that isn't a scheduled run", async () => {
    const response = await deliver({});

    expect(response.status).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });
});
