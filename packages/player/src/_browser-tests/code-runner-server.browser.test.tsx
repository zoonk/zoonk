import { type CodeRunResult } from "@zoonk/core/library/activities/sandbox-contract";
import { LearnProvider } from "@zoonk/learn/provider";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { checkActivity, expectVerdict } from "../_test-utils/activity-player";
import { render } from "../_test-utils/render";
import { buildAdapters, lessonPlayerElement } from "../_test-utils/render-lesson-player";
import { type CodeRunOutcome, type RunCode } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep } from "../preview/preview-steps";

const RUN_ID = "ec8eedd5-7adf-48aa-b686-ed38e40340b5";

const javaRunner = {
  ...activityContentFixtures.codeRunner,
  fields: {
    editableLines: [3],
    expectedOutput: "Hello, Java",
    language: "java",
    mistakes: [],
    solution:
      'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java");\n    }\n}',
    starterCode:
      'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}',
  },
  prompt: "Make it greet Java.",
};

function printed(output: string, stopped: Partial<CodeRunResult> = {}): CodeRunOutcome {
  return {
    result: { error: null, errorOutput: "", output, runId: RUN_ID, stop: "done", ...stopped },
    status: "finished",
  };
}

/** A guest's lesson page provides it, for the link that makes an account. */
const LEARN_ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

function openJava(runCode: RunCode) {
  const lesson = buildLesson([activityStep({ content: javaRunner })]);
  const adapters = buildAdapters(lesson, { runCode: vi.fn(runCode) });

  render(
    <LearnProvider adapters={LEARN_ADAPTERS}>
      {lessonPlayerElement({ adapters, lesson })}
    </LearnProvider>,
    { reactStrictMode: true },
  );

  return adapters;
}

const lineThree = () => page.getByRole("textbox", { name: "Line 3, yours to edit" });
const runButton = () => page.getByRole("button", { exact: true, name: "Run" });

describe("a code runner in a language our servers run", () => {
  it("names the language's file, shows each phase once a run takes a moment, and checks the run it graded", async () => {
    const compiled = Promise.withResolvers<null>();
    const ran = Promise.withResolvers<null>();
    const finished = Promise.withResolvers<CodeRunOutcome>();

    const adapters = openJava(async ({ onPhase }) => {
      onPhase("starting");
      await compiled.promise;
      onPhase("compiling");
      await ran.promise;
      onPhase("running");
      return finished.promise;
    });

    await expect.element(page.getByText("Main.java", { exact: true })).toBeVisible();
    await lineThree().fill('        System.out.println("Hello, Java");');
    await runButton().click();

    await expect.element(page.getByText("Getting Java ready…")).toBeVisible();
    compiled.resolve(null);
    await expect.element(page.getByText("Compiling your code…")).toBeVisible();
    ran.resolve(null);
    await expect.element(page.getByText("Running your code…")).toBeVisible();
    finished.resolve(printed("Hello, Java\n"));
    await expect.element(page.getByText("Hello, Java", { exact: true }).first()).toBeVisible();
    await expect.element(page.getByText("Running your code…")).not.toBeInTheDocument();

    await checkActivity();
    await expectVerdict("Correct!");

    expect(adapters.checkStep).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: {
          answer: { kind: "output", output: "Hello, Java\n", runId: RUN_ID },
          kind: "activity",
        },
      }),
    );
  });

  it("marks the line a build error names, and says a run took too long without a time", async () => {
    const outcomes = [
      printed("", {
        error: { line: 3, message: "Main.java:3: error: ';' expected" },
        errorOutput: "Main.java:3: error: ';' expected\n",
        stop: "error",
      }),
      printed("", { stop: "timeout" }),
    ];

    openJava(async () => outcomes.shift() ?? printed(""));
    await runButton().click();
    await expect.element(page.getByText("Line 3: Main.java:3: error: ';' expected")).toBeVisible();

    await runButton().click();

    await expect
      .element(page.getByText("Stopped because it took too long. Is there a loop that never ends?"))
      .toBeVisible();
  });

  it("asks again under the same request after a run broke off, and under a new one once the code changed", async () => {
    const requests: string[] = [];
    const outcomes: CodeRunOutcome[] = [{ status: "offline" }, { status: "offline" }];

    openJava(async ({ requestId }) => {
      requests.push(requestId);
      return outcomes.shift() ?? printed("Hello\n");
    });

    await runButton().click();

    await expect
      .element(page.getByText("Running Java code needs a connection. Check yours and try again."))
      .toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await lineThree().fill('        System.out.println("Hi");');
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByText("Hello", { exact: true }).first()).toBeVisible();

    expect(requests).toHaveLength(3);
    expect(requests[1]).toBe(requests[0]);
    expect(requests[2]).not.toBe(requests[0]);
  });

  it("stays busy while another run of the learner's is going, then shows its own", async () => {
    const outcomes: CodeRunOutcome[] = [{ status: "alreadyRunning" }];
    const requests: string[] = [];

    openJava(async ({ requestId }) => {
      requests.push(requestId);
      return outcomes.shift() ?? printed("Hello\n");
    });

    await runButton().click();
    await expect.element(runButton()).toHaveAttribute("aria-busy", "true");
    await expect.element(page.getByText("Hello", { exact: true }).first()).toBeVisible();
    expect(requests).toStrictEqual([requests[0], requests[0]]);
  });

  it("says the code didn't run when the server couldn't run it", async () => {
    openJava(async () => ({ status: "unavailable" }));
    await runButton().click();
    await expect.element(page.getByText("Your code didn't run. Try again.")).toBeVisible();
  });

  it("shows a used-up day of runs the way other help shows it, and keeps Run", async () => {
    openJava(async () => ({ period: "day", status: "limitReached", tier: "free" }));
    await runButton().click();
    await expect.element(page.getByText("No more code runs today")).toBeVisible();
    await expect.element(runButton()).toBeEnabled();
  });

  it("asks a guest for an account when running needs one", async () => {
    openJava(async () => ({ status: "signUpRequired" }));
    await runButton().click();
    await expect.element(page.getByText("This needs a free account")).toBeVisible();
  });
});
