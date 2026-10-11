import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSkillEvidence } from "../learner/_utils/load-skill-claims";
import { planLibraryFixture } from "./_test-utils/plan-library";
import { type RuleContext } from "./_test-utils/rules/rule-context";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

// The mistake classifier is a paid model call: a wrong answer whose cause isn't clear is a gap here.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({
  classifyMistakeCause: vi.fn(async () => ({ data: { cause: "gap" } })),
}));

// Vercel Blob is the external store a deleted account's files are removed from.
vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  list: vi.fn(async () => ({ blobs: [], cursor: undefined, hasMore: false })),
}));

const MINUTE = 60_000;

/**
 * The skills whose only answer so far is one right true-or-false one, and which the learner hasn't
 * studied or tested out: whether the plan took each as known, and what the syllabus says of its
 * topics.
 */
function readOnceRight(context: RuleContext) {
  const answers = Map.groupBy(context.answers ?? [], (answer) => answer.skillId);
  const known = new Set(context.learner?.knownSkillIds);

  const settled = new Set(
    context.after.items.flatMap((item) =>
      item.skillId && item.status !== "todo" && item.status !== "skipped" ? [item.skillId] : [],
    ),
  );

  const statuses = new Map(
    (context.syllabus?.subjects ?? [])
      .flatMap((subject) => subject.topics)
      .map((topic) => [topic.name, topic.status]),
  );

  return context.after.graph.skills
    .filter((skill) => {
      const [only, ...more] = answers.get(skill.skillId) ?? [];

      return (
        only?.correct &&
        only.format === "trueFalse" &&
        more.length === 0 &&
        !settled.has(skill.skillId)
      );
    })
    .map((skill) => ({
      planned: known.has(skill.skillId),
      skill: skill.name,
      topics: (skill.topics ?? []).map((topic) => statuses.get(topic)),
    }));
}

/*
 * A skill is known only from its own answers (R17): one right answer, two when the learner focused
 * on it, three right true-or-false ones, and no miss. One bar for the test-out, the plan's cut and
 * the syllabus's "known" (the lead, 10 Oct).
 */
describe("a skill the learner showed they know", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Câmara at 60 minutes a day: a first-week session's one right true-or-false answer
  // on electoral systems took the skill as known, the syllabus said so, and a plan short on time
  // cut its topic before any topic the learner didn't know. Placement asks Câmara's statements as
  // true or false too, so its answers hold the case whichever skills the sessions ask.
  it(
    "is never one right true-or-false answer",
    async () => {
      const contexts: RuleContext[] = [];

      await runSimLifeInDb(
        {
          dailyMinutes: 60,
          fixture: "camara",
          knownAreas: [],
          pending: [
            7, 9, 17, 24, 29, 35, 46, 49, 50, 52, 55, 63, 66, 83, 88, 91, 93, 97, 98, 104, 114, 117,
          ],
          seed: 2000,
          speed: 1,
          start: "2054-10-12",
          steps: [
            {
              answers: [
                [31, true],
                [25, false],
                [76, true],
              ],
              kind: "placement",
            },
            { kind: "refresh" },
            { finish: 0.25, kind: "study", misses: [32] },
            { finish: 1, kind: "study", misses: [] },
          ],
          subscribed: false,
          targetInDays: 72,
        },
        {
          check: (context) => {
            contexts.push(context);
            return [];
          },
          questions: true,
        },
      );

      const last = contexts.findLast((context) => context.event.kind !== "accountDeleted");
      const once = last ? readOnceRight(last) : [];

      expect(once.length).toBeGreaterThan(0);

      expect(once.filter((skill) => skill.planned || skill.topics.includes("known"))).toStrictEqual(
        [],
      );
    },
    5 * MINUTE,
  );

  // Career seed 2042: the Library outlined a portfolio case study with the lessons of a
  // journey map the learner had tested out of, and the case study read as known, though they never
  // answered on it; a plan that studies everything then dropped its lessons.
  it("is never a test-out of another skill whose lessons the Library links to it later", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 0, size: 2 }] });
    const [journey, caseStudy] = library.skills.map((skill) => skill.id);
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id, graph: library.graph });

    await Promise.all(
      library.lessons.map((lesson, position) =>
        planItemFixture({
          completedAt: new Date("2026-10-14T12:00:00Z"),
          lessonId: lesson.id,
          planId: plan.id,
          position,
          skillId: journey ?? null,
          status: "testedOut",
        }),
      ),
    );

    await Promise.all(
      library.lessons.map((lesson) =>
        lessonSkillFixture({ lessonId: lesson.id, skillId: caseStudy ?? "" }),
      ),
    );

    const { known } = await loadSkillEvidence({
      goalId: goal.id,
      skillIds: [journey ?? "", caseStudy ?? ""],
      userId: user.id,
    });

    expect([...known]).toStrictEqual([journey]);
  });
});
