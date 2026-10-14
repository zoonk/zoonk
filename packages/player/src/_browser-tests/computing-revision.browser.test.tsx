import { act } from "@testing-library/react";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { openActivity, pressOnPage } from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { RetainedLesson } from "../_test-utils/retained-lesson";
import { runInSandbox } from "../activities/_sandbox/sandbox-host";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep, explanationStep } from "../preview/preview-steps";

/** Delay only the worker/runtime boundary, while the real editors and output conversion run. */
vi.mock("../activities/_sandbox/sandbox-host", () => ({
  runInSandbox: vi.fn(),
  warmUpSandbox: vi.fn(async () => true),
}));

describe("output belongs to the editor revision that ran", () => {
  beforeEach(() => vi.mocked(runInSandbox).mockReset());

  it.each(["codeRunner", "sqlPlayground"] as const)(
    "a hidden %s owner returns with its draft and can run before its abandoned run finishes",
    async (template) => {
      const abandoned = Promise.withResolvers<Awaited<ReturnType<typeof runInSandbox>>>();
      const current = Promise.withResolvers<Awaited<ReturnType<typeof runInSandbox>>>();

      vi.mocked(runInSandbox)
        .mockReturnValueOnce(abandoned.promise)
        .mockReturnValueOnce(current.promise);

      const content =
        template === "codeRunner"
          ? {
              ...activityContentFixtures.codeRunner,
              fields: {
                ...activityContentFixtures.codeRunner.fields,
                editableLines: [1],
                language: "javascript",
                starterCode: 'console.log("old");',
              },
            }
          : activityContentFixtures.sqlPlayground;

      renderLessonPlayer({
        children: <RetainedLesson />,
        lesson: buildLesson([activityStep({ content })]),
      });

      const draft =
        template === "codeRunner"
          ? 'console.log("new");'
          : "SELECT name FROM countries ORDER BY name;";

      const editor = page.getByRole("textbox", {
        name: template === "codeRunner" ? "Line 1, yours to edit" : "Your query",
      });

      await editor.fill(draft);
      await page.getByRole("button", { exact: true, name: "Run" }).click();
      await page.getByRole("button", { name: "Hide lesson" }).click();
      await page.getByRole("button", { name: "Show lesson" }).click();
      await expect.element(editor).toHaveValue(draft);
      await expect.element(page.getByRole("button", { exact: true, name: "Run" })).toBeEnabled();
      await page.getByRole("button", { exact: true, name: "Run" }).click();

      expect(vi.mocked(runInSandbox).mock.calls[1]?.[0].payload).toMatchObject(
        template === "codeRunner" ? { code: draft } : { query: draft },
      );

      await act(async () => {
        abandoned.resolve({ status: "done", table: { columns: ["name"], rows: [["old"]] } });
        await abandoned.promise;
      });

      await expect
        .element(page.getByRole("button", { exact: true, name: "Running" }))
        .toBeDisabled();

      await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeDisabled();

      await act(async () => {
        vi.mocked(runInSandbox).mock.calls[1]?.[0].onMessage({
          id: 2,
          stream: "stdout",
          text: "new\n",
          type: "output",
        });

        current.resolve({ status: "done", table: { columns: ["name"], rows: [["new"]] } });
        await current.promise;
      });

      await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeEnabled();
    },
  );

  it.each(["codeRunner", "sqlPlayground"] as const)(
    "a departed %s run cannot clear a new answer after returning",
    async (template) => {
      const pending = Promise.withResolvers<Awaited<ReturnType<typeof runInSandbox>>>();

      vi.mocked(runInSandbox)
        .mockReturnValueOnce(pending.promise)
        .mockImplementationOnce(async ({ onMessage }) => {
          onMessage({ id: 2, stream: "stdout", text: "new\n", type: "output" });
          return { status: "done", table: { columns: ["name"], rows: [["new"]] } };
        });

      const content =
        template === "codeRunner"
          ? {
              ...activityContentFixtures.codeRunner,
              fields: { ...activityContentFixtures.codeRunner.fields, language: "javascript" },
            }
          : activityContentFixtures.sqlPlayground;

      const reading = explanationStep({ text: "Read before running." });
      renderLessonPlayer({ lesson: buildLesson([reading, activityStep({ content })]) });
      await page.getByRole("button", { exact: true, name: "Next" }).click();

      if (template === "sqlPlayground") {
        await page.getByRole("textbox", { name: "Your query" }).fill("SELECT name FROM countries;");
      }

      await page.getByRole("button", { exact: true, name: "Run" }).click();
      await pressOnPage("ArrowLeft");
      await expect.element(page.getByText(reading.content.text)).toBeVisible();
      await page.getByRole("button", { exact: true, name: "Next" }).click();

      if (template === "sqlPlayground") {
        await page.getByRole("textbox", { name: "Your query" }).fill("SELECT name FROM countries;");
      }

      await page.getByRole("button", { exact: true, name: "Run" }).click();
      await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeEnabled();

      await act(async () => {
        pending.resolve({ status: "done", table: { columns: ["name"], rows: [["old"]] } });
        await pending.promise;
      });

      await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeEnabled();
    },
  );

  it("editing pending code leaves its late output stale until the current code runs", async () => {
    const pending = Promise.withResolvers<Awaited<ReturnType<typeof runInSandbox>>>();

    vi.mocked(runInSandbox)
      .mockReturnValueOnce(pending.promise)
      .mockImplementationOnce(async ({ onMessage }) => {
        onMessage({ id: 2, stream: "stdout", text: "new\n", type: "output" });
        return { status: "done" };
      });

    const content = {
      ...activityContentFixtures.codeRunner,
      fields: {
        ...activityContentFixtures.codeRunner.fields,
        editableLines: [1],
        expectedOutput: "new",
        language: "javascript",
        solution: 'console.log("new");',
        starterCode: 'console.log("old");',
      },
    };

    openActivity({ content, template: "codeRunner" });
    await page.getByRole("button", { exact: true, name: "Run" }).click();
    await page.getByRole("textbox", { name: "Line 1, yours to edit" }).fill('console.log("new");');

    await act(async () => {
      vi.mocked(runInSandbox).mock.calls[0]?.[0].onMessage({
        id: 1,
        stream: "stdout",
        text: "old\n",
        type: "output",
      });

      pending.resolve({ status: "done" });
      await pending.promise;
    });

    await expect
      .element(page.getByText("You changed the code. Run it again to see the new output."))
      .toBeVisible();

    await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeDisabled();
    await page.getByRole("button", { name: "Run again" }).click();
    await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeEnabled();
    expect(vi.mocked(runInSandbox).mock.calls[1]?.[0].payload.code).toBe('console.log("new");');
  });

  it.each(["typing", "snippet"] as const)(
    "%s during a pending query keeps its late rows stale",
    async (edit) => {
      const pending = Promise.withResolvers<Awaited<ReturnType<typeof runInSandbox>>>();

      vi.mocked(runInSandbox)
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce({ status: "done", table: { columns: ["name"], rows: [["new"]] } });

      openActivity({ template: "sqlPlayground" });
      const query = page.getByRole("textbox", { name: "Your query" });
      await query.fill("SELECT name FROM countries;");
      await page.getByRole("button", { exact: true, name: "Run" }).click();

      if (edit === "typing") {
        await query.fill("SELECT name FROM countries ORDER BY name;");
      } else {
        await page.getByRole("button", { exact: true, name: "WHERE" }).click();
      }

      await act(async () => {
        pending.resolve({ status: "done", table: { columns: ["name"], rows: [["old"]] } });
        await pending.promise;
      });

      await expect
        .element(page.getByText("You changed the query. Run it again to see the new result."))
        .toBeVisible();

      await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeDisabled();
      await page.getByRole("button", { name: "Run again" }).click();
      await expect.element(page.getByRole("button", { exact: true, name: "Check" })).toBeEnabled();
    },
  );
});
