import { randomUUID } from "node:crypto";
import {
  type PlannedActivityChange,
  planLessonActivities,
} from "@zoonk/ai/tasks/lesson-spec/activity-plan";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { writeLessonActivities } from "@zoonk/ai/tasks/lesson-writer/activities";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { writeLessonContent } from "../../_test-utils/write-lesson-content";
import {
  approve,
  proposeFix,
  signInApprover,
  signInProposer,
} from "../../staff/content-fixes/_test-utils/content-fix-steps";
import { completeLessonContent } from "../generation/lesson-generation-state";
import { temperatureSpec, writtenTemperatureLesson } from "../quality/_test-utils/written-lessons";
import { draftLessonActivities } from "./add-lesson-activities";

/** The temperature lesson's check right after its worked example. */
const PRACTICE = 3;

type ReviewIssue = Awaited<ReturnType<typeof checkLessonQuality>>["data"]["issues"][number];

function provenance(model = "anthropic/claude-opus-5.5") {
  return {
    generatedAt: new Date().toISOString(),
    latencyMs: 1,
    model,
    promptVersion: "test-prompt",
    provider: "test",
    requestedModel: model,
    runId: randomUUID(),
    usage: {},
  };
}

function runner(expectedOutput = "2") {
  return {
    check: { explanation: "A rise adds to the start: −3 + 5 is 2.", kind: "interaction" },
    fields: {
      editableLines: [3],
      expectedOutput,
      language: "javascript",
      mistakes: [{ feedback: "A rise adds degrees; it doesn't take them away.", output: "-8" }],
      solution: "const start = -3;\nconst rise = 5;\nconsole.log(start + rise);",
      starterCode: "const start = -3;\nconst rise = 5;\nconsole.log(start - rise);",
    },
    prompt: "Fix the last line so it prints the temperature after the rise.",
  };
}

function revisedSpec(): LessonSpec {
  const spec = temperatureSpec();

  return {
    ...spec,
    screens: spec.screens.map((screen, index) =>
      index === PRACTICE
        ? {
            ...screen,
            activityTemplate: "codeRunner",
            brief: "Fix the line that adds the rise to −3 so it prints 2.",
            kind: "activity",
            visual: null,
            visualKind: "template",
          }
        : screen,
    ),
  };
}

function mockPlan(
  changes: PlannedActivityChange[] = [{ activityTemplate: "codeRunner", index: PRACTICE }],
) {
  vi.mocked(planLessonActivities).mockResolvedValueOnce({
    data: { changes, spec: changes.length > 0 ? revisedSpec() : temperatureSpec() },
    provenance: provenance("openai/gpt-6.1-sol"),
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function mockWrite(content: object) {
  vi.mocked(writeLessonActivities).mockResolvedValueOnce({
    data: [
      {
        index: PRACTICE,
        screen: { content: JSON.stringify(content), kind: "activity", template: "codeRunner" },
      },
    ],
    provenance: provenance(),
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function mockReview(issues: ReviewIssue[] = []) {
  vi.mocked(checkLessonQuality).mockResolvedValueOnce({
    data: { issues },
    provenance: provenance("openai/gpt-6-astra"),
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function publishLesson() {
  const workflowRunId = randomUUID();
  const skill = await skillFixture({ name: "Add a rise to a temperature below zero" });

  const lesson = await libraryLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: "running",
    spec: temperatureSpec(),
    specStatus: "completed",
  });

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

  vi.mocked(writeLessonDraft).mockResolvedValueOnce({
    data: writtenTemperatureLesson(),
    provenance: provenance(),
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

  if (result.status !== "published") {
    throw new Error(`The test lesson wasn't published: ${result.status}`);
  }

  await completeLessonContent({ lessonId: lesson.id, workflowRunId });

  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: { lessonId: lesson.id, retiredAt: null, staged: false },
  });

  return { lesson, skill, steps };
}

describe(draftLessonActivities, () => {
  it("skips language lessons and lessons that aren't written", async () => {
    const [language, unwritten] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed", targetLanguage: "es" }),
      libraryLessonFixture({ contentStatus: "pending" }),
    ]);

    await expect(draftLessonActivities({ lessonId: language.id })).resolves.toMatchObject({
      reason: expect.stringContaining("language lesson"),
      status: "skipped",
    });

    await expect(draftLessonActivities({ lessonId: unwritten.id })).resolves.toMatchObject({
      reason: "Not written yet.",
      status: "skipped",
    });

    expect(planLessonActivities).not.toHaveBeenCalled();
  });

  it("skips a lesson none of whose practice screens fits an activity", async () => {
    const { lesson } = await publishLesson();
    mockPlan([]);

    await expect(draftLessonActivities({ lessonId: lesson.id })).resolves.toMatchObject({
      status: "skipped",
    });

    expect(writeLessonActivities).not.toHaveBeenCalled();
  });

  it("replaces only the practice screen and puts its template in the plan", async () => {
    const { lesson, skill, steps } = await publishLesson();
    mockPlan();
    mockWrite(runner());
    mockReview();

    const draft = await draftLessonActivities({ lessonId: lesson.id });

    expect(draft).toMatchObject({
      added: [{ screen: PRACTICE + 1, template: "codeRunner" }],
      dropped: [],
      findings: [],
      status: "drafted",
    });

    if (draft.status !== "drafted") {
      throw new Error("Expected a draft");
    }

    expect(draft.setPlan.screens[PRACTICE]).toMatchObject({
      activityTemplate: "codeRunner",
      kind: "activity",
    });

    expect(draft.setScreens.version).toBe(steps[0]?.version);

    const expected: object[] = steps.map((step) => ({ id: step.id }));

    expected[PRACTICE] = {
      content: expect.objectContaining({ template: "codeRunner" }),
      idea: expect.toBeOneOf([null, expect.any(Number)]),
      kind: "activity",
      skillId: skill.id,
    };

    expect(draft.setScreens.screens).toStrictEqual(expected);

    const reviewed = vi.mocked(checkLessonQuality).mock.lastCall?.[0];
    expect(reviewed?.lesson.screens[PRACTICE]?.kind).toBe("activity");
    expect(reviewed?.spec.screens[PRACTICE]?.activityTemplate).toBe("codeRunner");
  });

  it("writes an activity again once when its program fails, with what failed", async () => {
    const { lesson } = await publishLesson();
    mockPlan();
    mockWrite(runner("8"));
    mockWrite(runner());
    mockReview();

    await expect(draftLessonActivities({ lessonId: lesson.id })).resolves.toMatchObject({
      added: [{ screen: PRACTICE + 1, template: "codeRunner" }],
      status: "drafted",
    });

    expect(writeLessonActivities).toHaveBeenCalledTimes(2);

    expect(vi.mocked(writeLessonActivities).mock.lastCall?.[0]).toMatchObject({
      indexes: [PRACTICE],
      problems: [
        expect.objectContaining({
          problem: expect.stringContaining("expectedOutput"),
          screen: PRACTICE,
        }),
      ],
    });
  });

  it("leaves out an activity the check flags and reports findings on other screens", async () => {
    const { lesson, steps } = await publishLesson();
    mockPlan();
    mockWrite(runner());

    mockReview([
      { fix: "Ask for the sum.", problem: "The prompt asks for a difference.", screen: PRACTICE },
      { fix: "Say −3.", problem: "The hook's start is −2.", screen: 0 },
    ]);

    await expect(draftLessonActivities({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      reason: expect.stringContaining(`The check flagged screen ${PRACTICE + 1}`),
      status: "skipped",
    });

    mockPlan();
    mockWrite(runner());
    mockReview([{ fix: "Say −3.", problem: "The hook's start is −2.", screen: 0 }]);

    await expect(draftLessonActivities({ lessonId: lesson.id })).resolves.toMatchObject({
      findings: [{ problem: expect.stringContaining("The hook's start"), stepId: steps[0]?.id }],
      status: "drafted",
    });
  });

  it("drafts a fix the content-fix flow accepts and applies", async () => {
    const { lesson, steps } = await publishLesson();
    mockPlan();
    mockWrite(runner());
    mockReview();

    const draft = await draftLessonActivities({ lessonId: lesson.id });

    if (draft.status !== "drafted") {
      throw new Error("Expected a draft");
    }

    await signInProposer();

    // The draft reaches the proposal as JSON: the API's response, saved by the CLI to a file.
    const proposal: unknown = await Response.json({
      changes: [
        { id: lesson.id, model: "Lesson", setPlan: draft.setPlan },
        { id: lesson.id, model: "Lesson", setScreens: draft.setScreens },
      ],
      reason: draft.reason,
    }).json();

    const fix = await proposeFix(proposal);

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const live = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id, retiredAt: null, staged: false },
    });

    const kinds = steps.map((step) => step.kind);
    kinds[PRACTICE] = "activity";

    expect(live.map((step) => step.kind)).toStrictEqual(kinds);
    expect(live[PRACTICE]?.content).toMatchObject({ template: "codeRunner" });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({
      spec: expect.objectContaining({
        screens: expect.arrayContaining([
          expect.objectContaining({ activityTemplate: "codeRunner", kind: "activity" }),
        ]),
      }),
    });
  });
});
