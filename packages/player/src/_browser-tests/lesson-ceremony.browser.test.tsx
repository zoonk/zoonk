import { MilestoneCeremony } from "@zoonk/learn/ceremony";
import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson, localAdapters } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const RIGHT_OPTION = "Where the electron is most likely to be found";

const CEREMONY_STEADY_MS = 600;

const LEARN_ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

function completeWithBelt(lesson: ReturnType<typeof buildLesson>) {
  const local = localAdapters(lesson);

  return vi.fn<LessonPlayerAdapters["completeLesson"]>(async (input) => {
    const outcome = await local.completeLesson(input);

    return outcome.status === "completed"
      ? {
          ...outcome,
          completion: {
            ...outcome.completion,
            ceremony: {
              beltStartBrainPower: null,
              earnedAt: new Date().toISOString(),
              id: "belt-orange",
              key: "orange",
              kind: "belt" as const,
              shownAt: null,
            },
          },
        }
      : outcome;
  });
}

function watchHandover() {
  const seen = { both: false, neither: false };

  const check = () => {
    const ceremony = document.querySelector('[data-slot="milestone-ceremony"]') !== null;
    const end = document.querySelector('[data-slot="lesson-completion"]') !== null;

    seen.both ||= ceremony && end;
    seen.neither ||= !ceremony && !end;
  };

  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });

  return { seen, stop: () => observer.disconnect() };
}

describe("a lesson's milestone ceremony", () => {
  it("fades out over the lesson's end, never a blank screen, and leaves the end's title focused", async () => {
    const lesson = buildLesson([teachingStep("check")]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { completeLesson: completeWithBelt(lesson) }),
      children: (
        <LearnProvider adapters={LEARN_ADAPTERS}>
          <LessonPlayerShell />
        </LearnProvider>
      ),
      lesson,
      slots: {
        ceremony: (milestone, onClose) => (
          <MilestoneCeremony
            buddy={null}
            milestone={milestone}
            onClose={onClose}
            onShown={vi.fn()}
          />
        ),
      },
    });

    await page.getByRole("radio", { name: RIGHT_OPTION }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();

    const ceremony = page.getByRole("dialog", { name: "Orange belt!" });
    await expect.element(ceremony).toBeVisible();

    await new Promise((resolve) => {
      setTimeout(resolve, CEREMONY_STEADY_MS);
    });

    const handover = watchHandover();
    await ceremony.getByRole("button", { name: /^Continue/u }).click();

    const title = page.getByRole("heading", { level: 2, name: "Lesson complete" });
    await expect.element(ceremony).not.toBeInTheDocument();
    await expect.element(title).toHaveFocus();
    handover.stop();

    expect(handover.seen).toStrictEqual({ both: true, neither: false });
  });
});
