import "server-only";
import { type Goal, type MasteryState, prisma } from "@zoonk/db";
import { getCurrentUserReviewSchedule } from "../../learner/get-current-user-review-schedule";
import { listCurrentUserSkills } from "../../learner/list-current-user-skills";
import { type SkillStateCounts } from "../../learner/mastery-state";
import { toSummaryIdeas } from "../../library/lessons/_utils/summary-ideas";
import { groupSkillsBySection } from "../_utils/group-skills";
import { resolveViewGoal } from "../_utils/resolve-view-goal";

/** The latest summary cards; older ones stay in the lessons themselves. */
const MAX_SUMMARIES = 30;

/**
 * A skill as a study card: the idea on the front, an example on the back, and its memory. Gold is
 * the Mastered state (remembered on three different days); a fading card dims until it's reviewed.
 */
type ContentCard = {
  description: string | null;
  example: string | null;
  fading: boolean;
  name: string;
  recallDays: number;
  retrievability: number | null;
  skillId: string;
  state: MasteryState;
};

/**
 * One chapter (or plan phase) of cards. `section` is the course or exam subject above it, so both
 * modes can show areas, then chapters; groups of one section always come together.
 */
type ContentGroup = {
  areaId: string;
  cards: ContentCard[];
  counts: SkillStateCounts;
  section: string | null;
  title: string;
};

/** Every finished lesson leaves its summary card: each idea in one sentence. */
type ContentSummary = { finishedAt: string; ideas: string[]; lessonId: string; title: string };

/**
 * Content for one goal: every skill as a card grouped by section (the course or exam subject) and
 * area (chapters, in plan order) with counts for the filters, the saved summary cards, and today's reviews. Focus lists the same skills with
 * their states; Fun shows them as Cards, revealed after the first review.
 */
export type ContentView = {
  capsules: { dueToday: number };
  counts: SkillStateCounts;
  goal: Pick<Goal, "id" | "kind" | "title">;
  groups: ContentGroup[];
  reveal: { cards: boolean };
  summaries: ContentSummary[];
  summaryCount: number;
};

export type ContentViewResult =
  | { content: ContentView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

async function loadSummaries(goalId: string) {
  const where = { lessonId: { not: null }, plan: { goalId }, status: "done" as const };

  const [items, count] = await Promise.all([
    prisma.planItem.findMany({
      orderBy: [{ completedAt: "desc" }, { position: "desc" }],
      select: {
        completedAt: true,
        lesson: { select: { id: true, summary: true, title: true } },
        titleSnapshot: true,
        updatedAt: true,
      },
      take: MAX_SUMMARIES,
      where,
    }),
    prisma.planItem.count({ where }),
  ]);

  const summaries = items.flatMap(({ completedAt, lesson, titleSnapshot, updatedAt }) => {
    const ideas = lesson ? toSummaryIdeas(lesson.summary) : [];

    return lesson && ideas.length > 0
      ? [
          {
            finishedAt: (completedAt ?? updatedAt).toISOString(),
            ideas,
            lessonId: lesson.id,
            title: lesson.title || titleSnapshot,
          },
        ]
      : [];
  });

  return { count, summaries };
}

/** Cards show up in Fun once the learner has opened their first capsules. */
async function hasReviewed(userId: string) {
  const review = await prisma.learningEvent.findFirst({
    select: { id: true },
    where: { endedAt: { not: null }, kind: "review", userId },
  });

  return review !== null;
}

/** Content for a goal (the active goal by default). */
export async function getContentView(input: { goalId?: string } = {}): Promise<ContentViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  const [skills, schedule, summaries, reviewed] = await Promise.all([
    listCurrentUserSkills({ goalId: goal.id }),
    getCurrentUserReviewSchedule({ goalId: goal.id }),
    loadSummaries(goal.id),
    hasReviewed(goal.userId),
  ]);

  if (skills.status !== "ready") {
    return { status: "notFound" };
  }

  return {
    content: {
      capsules: { dueToday: schedule.status === "ready" ? schedule.schedule.dueToday.length : 0 },
      counts: skills.counts,
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      groups: groupSkillsBySection(skills.skills).map(
        ({ areaId, counts, section, skills: cards, title }) => ({
          areaId,
          cards: cards.map((card) => ({
            description: card.description,
            example: card.example,
            fading: card.fading,
            name: card.name,
            recallDays: card.recallDays,
            retrievability: card.retrievability,
            skillId: card.skillId,
            state: card.state,
          })),
          counts,
          section,
          title,
        }),
      ),
      reveal: { cards: reviewed },
      summaries: summaries.summaries,
      summaryCount: summaries.count,
    },
    status: "ready",
  };
}
