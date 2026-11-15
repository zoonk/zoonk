import { type SpeakingPaperView } from "@zoonk/core/language/exam-speaking/contract";
import { SpeakingPracticeScreen } from "@zoonk/learn/language/speaking";
import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";

const ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

const TASK: Omit<SpeakingPaperView["tasks"][number], "key" | "name"> = {
  criteria: [{ key: "fluency", name: "Fluidez" }],
  lastTry: null,
  minutes: { max: 7, min: 6 },
  mode: "interaction",
  options: 1,
  prepMinutes: 10,
  prepShared: null,
  role: "examiner",
  stimulus: "topic",
};

const PAPER: SpeakingPaperView = {
  access: "open",
  exam: "dele",
  language: "es",
  level: "B2",
  minutes: { max: 20, min: 15 },
  paper: "Expresión e interacción orales",
  prepMinutes: 20,
  prepTasks: ["t1", "t2"],
  source: "https://examenes.cervantes.es",
  tasks: [
    { ...TASK, key: "t1", name: "Tarea 1: Valorar propuestas" },
    { ...TASK, key: "t2", name: "Tarea 2: Describir una fotografía" },
  ],
  title: "DELE B2",
};

describe("a speaking task refused for call time", () => {
  it("says why under the Start that was refused, not under another task", async () => {
    const onStart = vi.fn(async () => ({
      limit: {
        availableAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        period: "rolling30Days" as const,
        tier: "plus" as const,
      },
    }));

    render(
      <LearnProvider adapters={ADAPTERS}>
        <SpeakingPracticeScreen
          backHref="/plan"
          onStart={onStart}
          openTask="t2"
          paper={PAPER}
          resultHref={(id) => `/conversation/${id}`}
        />
      </LearnProvider>,
    );

    const first = page.getByRole("listitem").filter({ hasText: "Tarea 1" });
    const second = page.getByRole("listitem").filter({ hasText: "Tarea 2" });

    await second.getByRole("button", { name: "Start" }).click();

    await expect
      .element(second.getByRole("alert").getByText("You've used your call time"))
      .toBeVisible();

    expect(onStart).toHaveBeenCalledWith("t2");
    await expect.element(first.getByRole("alert")).not.toBeInTheDocument();
  });

  it("says only that the learner can try again once the call time comes back, under the Start that stayed", async () => {
    const onStart = vi.fn(async () => ({
      limit: {
        availableAt: new Date(Date.now() + 1500).toISOString(),
        period: "rolling30Days" as const,
        tier: "free" as const,
      },
    }));

    render(
      <LearnProvider adapters={ADAPTERS}>
        <SpeakingPracticeScreen
          backHref="/plan"
          onStart={onStart}
          openTask="t1"
          paper={PAPER}
          resultHref={(id) => `/conversation/${id}`}
        />
      </LearnProvider>,
    );

    const task = page.getByRole("listitem").filter({ hasText: "Tarea 1" });
    await task.getByRole("button", { name: "Start" }).click();
    await expect.element(task.getByText("You've used your call time")).toBeVisible();
    await expect.element(task.getByRole("link", { name: "Subscribe" })).toBeVisible();

    await expect.element(task.getByText("You can try again now.")).toBeVisible();
    await expect.element(task.getByText("You've used your call time")).not.toBeInTheDocument();
    await expect.element(task.getByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
    await expect.element(task.getByRole("button", { name: "Start" })).toBeVisible();
  });
});
