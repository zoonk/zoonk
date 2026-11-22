import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mergeIntoSharedCopy, uploadWithSharedCopyFixture } from "../../_test-utils/merged-upload";
import { mockSession } from "../../_test-utils/mock-session";
import { moveLanguageGoalToExam } from "../../exams/move-language-goal";
import { type GoalDraft } from "../../goals/goal-contract";
import { loadGoalMaterial } from "../../library/sources/goal-material";
import { isInputRangeError } from "../../plans/target-date-range";
import { getSession } from "../../users/get-session";
import { getLearnerToday } from "./_utils/understanding-view";
import { createOnboardingGoals } from "./create-onboarding-goals";
import { getOnboarding } from "./get-onboarding";

const dayAheadZone = "Pacific/Kiritimati";

function learnGoal(details: GoalDraft["details"]): GoalDraft {
  return {
    details: { purpose: "overview", ...details },
    kind: "learn",
    language: "en",
    prompt: "Learn chess",
    targetDate: getLearnerToday(dayAheadZone),
    title: "Learn chess",
  };
}

function cardGoal(onboardingId: string, title = "Learn chess"): GoalDraft {
  return { ...learnGoal({ onboardingId }), targetDate: undefined, title };
}

async function confirm(goals: GoalDraft[]) {
  const created = await createOnboardingGoals({ dailyMinutes: 30, goals, timeZone: "UTC" });
  return created.status === "created" ? created.goals.map((goal) => goal.id) : [];
}

async function uploadFixture(userId: string) {
  const source = await sourceFixture({
    extractedText: "The cell cycle runs through G1, S, G2 and M.",
    kind: "upload",
    title: "Cell cycle.pdf",
  });

  await learnerSourceFixture({ sourceId: source.id, userId });
  return source.id;
}

/** For each source, the goals that read it as the learner's material. */
function findLinkedGoalIds(sourceIds: string[]) {
  return prisma.goalSource
    .findMany({
      orderBy: { goalId: "asc" },
      select: { goalId: true, sourceId: true },
      where: { origin: "upload", sourceId: { in: sourceIds } },
    })
    .then((links) =>
      sourceIds.map((id) =>
        links.filter((link) => link.sourceId === id).map((link) => link.goalId),
      ),
    );
}

function readMaterialIds(goalId: string | undefined) {
  return loadGoalMaterial(goalId ?? "").then((sources) => sources.map((source) => source.id));
}

function findDetails(goalId: string | undefined) {
  return prisma.goal
    .findUniqueOrThrow({ select: { details: true }, where: { id: goalId } })
    .then((goal) => goal.details);
}

function countClaims(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "goal", userId } });
}

describe(createOnboardingGoals, () => {
  it("starts a card's goal whose date is no longer ahead without it, and setup asks the date", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const created = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [learnGoal({ onboardingId: randomUUID() })],
      timeZone: dayAheadZone,
    });

    expect(created).toMatchObject({ goals: [{ targetDate: null }], status: "created" });

    const goalId = created.status === "created" ? (created.goals[0]?.id ?? "") : "";
    const setup = await getOnboarding({ goalId });

    expect(setup.status === "ready" && setup.onboarding.steps).toContain("targetDate");
  });

  it("counts a card's date from one moment, so a confirm that crosses midnight still starts", async () => {
    const user = await userFixture();
    freezeClock();
    vi.setSystemTime(new Date("2026-11-04T23:59:59.999Z"));
    mockSession(user.id);
    const signedIn = vi.mocked(getSession).getMockImplementation();

    vi.mocked(getSession).mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-11-05T00:00:00.001Z"));
      return (await signedIn?.()) ?? null;
    });

    const created = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [{ ...learnGoal({ onboardingId: randomUUID() }), targetDate: "2026-11-05" }],
      timeZone: "UTC",
    });

    expect(created).toMatchObject({ goals: [{ targetDate: null }], status: "created" });
  });

  describe("confirming a card again", () => {
    it("returns the goal it made instead of making and charging another", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const first = await confirm([cardGoal(card.id)]);
      const again = await confirm([cardGoal(card.id)]);

      expect(first).toHaveLength(1);
      expect(again).toStrictEqual(first);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(countClaims(user.id)).resolves.toBe(1);
    });

    it("leaves the goal the learner studies now as it is", async () => {
      const user = await userFixture();

      const [first, second] = await Promise.all([
        onboardingDraftFixture({ userId: user.id }),
        onboardingDraftFixture({ userId: user.id }),
      ]);

      mockSession(user.id);

      await confirm([cardGoal(first.id)]);
      const [studied] = await confirm([cardGoal(second.id)]);
      await confirm([cardGoal(first.id)]);

      await expect(
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ activeGoalId: studied });
    });

    it("reports the runs each goal saved, each on its own, so only missing work starts", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const send = () =>
        createOnboardingGoals({ dailyMinutes: 30, goals: [cardGoal(card.id)], timeZone: "UTC" });

      const first = await send();
      const goalId = first.status === "created" ? (first.goals[0]?.id ?? "") : "";
      const unstarted = await send();

      await prisma.goal.update({ data: { researchRunId: "wrun_research" }, where: { id: goalId } });
      const researched = await send();

      await prisma.goal.update({
        data: { generationRunId: "wrun_curriculum" },
        where: { id: goalId },
      });

      const started = await send();

      expect(first).toMatchObject({ saved: [{ generationId: null, goalId, researchId: null }] });

      expect(unstarted).toMatchObject({
        saved: [{ generationId: null, goalId, researchId: null }],
      });

      expect(researched).toMatchObject({
        saved: [{ generationId: null, goalId, researchId: "wrun_research" }],
      });

      expect(started).toMatchObject({
        saved: [{ generationId: "wrun_curriculum", goalId, researchId: "wrun_research" }],
      });
    });

    it("returns the newest of two live goals at one place, after one is restored", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [restored] = await confirm([cardGoal(card.id)]);
      await prisma.goal.update({ data: { status: "archived" }, where: { id: restored } });
      const [newest] = await confirm([cardGoal(card.id)]);
      await prisma.goal.update({ data: { status: "paused" }, where: { id: restored } });
      await prisma.goal.update({ data: { dailyMinutes: 20 }, where: { id: newest } });

      await expect(confirm([cardGoal(card.id)])).resolves.toStrictEqual([newest]);
    });

    it("makes one goal when two confirms arrive at once", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [first, second] = await Promise.all([
        confirm([cardGoal(card.id)]),
        confirm([cardGoal(card.id)]),
      ]);

      expect(first).toHaveLength(1);
      expect(second).toStrictEqual(first);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
    });

    it("returns each of a card's goals in its place", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);
      const goals = [cardGoal(card.id, "Learn chess"), cardGoal(card.id, "Learn go")];

      const first = await confirm(goals);
      const again = await confirm(goals);

      expect(first).toHaveLength(2);
      expect(again).toStrictEqual(first);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(2);
    });

    it("starts a goal waiting on the card as a new goal", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [first] = await confirm([cardGoal(card.id, "Learn chess")]);

      const waiting = await confirm([
        {
          ...cardGoal(card.id, "Learn go"),
          details: { onboardingId: card.id, onboardingPlace: 1 },
        },
      ]);

      expect(waiting).toStrictEqual([expect.not.stringMatching(first ?? "")]);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(2);
    });

    it("starts the card's goal again once the learner archived it", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [archived] = await confirm([cardGoal(card.id)]);
      await prisma.goal.update({ data: { status: "archived" }, where: { id: archived } });

      const again = await confirm([cardGoal(card.id)]);

      expect(again).toStrictEqual([expect.not.stringMatching(archived ?? "")]);
    });

    it("returns the exam goal a card's language goal moved to", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const english: GoalDraft = {
        details: { onboardingId: card.id, reason: "vou fazer o IELTS em março" },
        kind: "language",
        language: "pt",
        prompt: "Aprender inglês",
        targetLanguage: "en",
        title: "Aprender inglês",
      };

      const [languageGoal] = await confirm([english]);
      const moved = await moveLanguageGoalToExam(languageGoal ?? "");
      const again = await confirm([english]);

      expect(again).toStrictEqual([moved.status === "moved" ? moved.goal.id : "not moved"]);
    });

    it("never returns a goal from another learner's card", async () => {
      const owner = await userFixture();
      const card = await onboardingDraftFixture({ userId: owner.id });
      mockSession(owner.id);
      const [ownersGoal] = await confirm([cardGoal(card.id)]);

      const other = await userFixture();
      mockSession(other.id);
      const forged = await confirm([cardGoal(card.id)]);

      expect(forged).toStrictEqual([expect.not.stringMatching(ownersGoal ?? "")]);
      await expect(prisma.goal.count({ where: { userId: other.id } })).resolves.toBe(1);
    });
  });

  describe("a card sent with material", () => {
    it("creates its main goal with the draft's material and choice, whatever the client sends", async () => {
      const user = await userFixture();
      const sourceIds = await Promise.all([uploadFixture(user.id), uploadFixture(user.id)]);

      const card = await onboardingDraftFixture({
        materialIntent: "understand",
        sourceIds,
        userId: user.id,
      });

      mockSession(user.id);

      const sent: GoalDraft = {
        ...cardGoal(card.id),
        details: { materialIntent: "exam", onboardingId: card.id },
      };

      const [goalId] = await confirm([sent]);
      const again = await confirm([sent]);

      expect(again).toStrictEqual([goalId]);

      await expect(findDetails(goalId)).resolves.toMatchObject({
        materialIntent: "understand",
        purpose: "other",
      });

      await expect(findLinkedGoalIds(sourceIds)).resolves.toStrictEqual([[goalId], [goalId]]);
    });

    it("links only the card's material, never more the client sends with it", async () => {
      const user = await userFixture();
      const [notes, extra] = await Promise.all([uploadFixture(user.id), uploadFixture(user.id)]);
      const card = await onboardingDraftFixture({ sourceIds: [notes], userId: user.id });
      mockSession(user.id);

      const sent = { dailyMinutes: 30, goals: [cardGoal(card.id)], timeZone: "UTC" };
      const created = await createOnboardingGoals({ ...sent, sourceIds: [extra] });
      const again = await createOnboardingGoals({ ...sent, sourceIds: [extra] });

      const goalId = created.status === "created" ? created.goals[0]?.id : undefined;

      expect(again).toMatchObject({ goals: [{ id: goalId }] });

      await expect(findLinkedGoalIds([notes, extra])).resolves.toStrictEqual([[goalId], []]);
    });

    it("leaves out a choice the learner didn't make on the card", async () => {
      const user = await userFixture();
      const notes = await uploadFixture(user.id);
      const card = await onboardingDraftFixture({ sourceIds: [notes], userId: user.id });
      mockSession(user.id);

      const [goalId] = await confirm([
        { ...cardGoal(card.id), details: { materialIntent: "exam", onboardingId: card.id } },
      ]);

      await expect(findDetails(goalId)).resolves.not.toHaveProperty("materialIntent");
      await expect(findLinkedGoalIds([notes])).resolves.toStrictEqual([[goalId]]);
    });

    it("gives each card's goal the material it was sent with, even when another goal reads it", async () => {
      const user = await userFixture();
      const notes = await uploadFixture(user.id);

      const [first, second] = await Promise.all([
        onboardingDraftFixture({ materialIntent: "exam", sourceIds: [notes], userId: user.id }),
        onboardingDraftFixture({ materialIntent: "exam", sourceIds: [notes], userId: user.id }),
      ]);

      mockSession(user.id);
      const [firstGoal] = await confirm([cardGoal(first.id)]);
      const [secondGoal] = await confirm([cardGoal(second.id)]);

      expect(secondGoal).toStrictEqual(expect.any(String));
      expect(secondGoal).not.toBe(firstGoal);
      await expect(findDetails(secondGoal)).resolves.toMatchObject({ materialIntent: "exam" });

      await expect(
        Promise.all([readMaterialIds(firstGoal), readMaterialIds(secondGoal)]),
      ).resolves.toStrictEqual([[notes], [notes]]);
    });

    it("creates its main goal with an upload merged into a shared copy before the learner confirmed", async () => {
      const user = await userFixture();
      const { shared, upload } = await uploadWithSharedCopyFixture(user.id);

      const card = await onboardingDraftFixture({
        materialIntent: "exam",
        sourceIds: [upload.id],
        userId: user.id,
      });

      await mergeIntoSharedCopy(upload);
      mockSession(user.id);

      const [goalId] = await confirm([cardGoal(card.id)]);

      await expect(readMaterialIds(goalId)).resolves.toStrictEqual([shared.id]);
    });

    it("still links the material a client sends with a card that kept none", async () => {
      const user = await userFixture();
      const notes = await uploadFixture(user.id);
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const created = await createOnboardingGoals({
        dailyMinutes: 30,
        goals: [
          { ...cardGoal(card.id), details: { materialIntent: "exam", onboardingId: card.id } },
        ],
        sourceIds: [notes],
        timeZone: "UTC",
      });

      const goalId = created.status === "created" ? created.goals[0]?.id : undefined;

      await expect(findDetails(goalId)).resolves.toMatchObject({ materialIntent: "exam" });
      await expect(findLinkedGoalIds([notes])).resolves.toStrictEqual([[goalId]]);
    });
  });

  it("refuses a date no card gave", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const refusal = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [learnGoal({})],
      timeZone: dayAheadZone,
    }).catch((error: unknown) => (isInputRangeError(error) ? error.issues : error));

    expect(refusal).toMatchObject([{ params: { bound: "earliest" } }]);
  });
});
