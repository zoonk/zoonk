import "server-only";
import { type Goal, type MasteryState } from "@zoonk/db";
import { getCurrentUserReviewSchedule } from "../../learner/get-current-user-review-schedule";
import { listCurrentUserSkills } from "../../learner/list-current-user-skills";
import { type SkillStateCounts } from "../../learner/mastery-state";
import { groupSkillsBySection } from "../_utils/group-skills";
import { resolveViewGoal } from "../_utils/resolve-view-goal";

type ContentCard = {
  description: string | null;
  dueToday: boolean;
  example: string | null;
  fading: boolean;
  name: string;
  recallDays: number;
  retrievability: number | null;
  skillId: string;
  state: MasteryState;
};

/** Section groups remain contiguous and areas retain plan order. */
type ContentGroup = {
  areaId: string;
  cards: ContentCard[];
  counts: SkillStateCounts;
  section: string | null;
  title: string;
};

export type ContentView = {
  capsules: { dueToday: number };
  counts: SkillStateCounts;
  goal: Pick<Goal, "id" | "kind" | "title">;
  groups: ContentGroup[];
};

export type ContentViewResult =
  | { content: ContentView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/** Requires ownership of the requested or default active goal. */
export async function getContentView(input: { goalId?: string } = {}): Promise<ContentViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  const [skills, schedule] = await Promise.all([
    listCurrentUserSkills({ goalId: goal.id }),
    getCurrentUserReviewSchedule({ goalId: goal.id }),
  ]);

  if (skills.status !== "ready") {
    return { status: "notFound" };
  }

  const dueToday = new Set(
    schedule.status === "ready" ? schedule.schedule.dueToday.map((review) => review.skillId) : [],
  );

  return {
    content: {
      capsules: { dueToday: dueToday.size },
      counts: skills.counts,
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      groups: groupSkillsBySection(skills.skills).map(
        ({ areaId, counts, section, skills: cards, title }) => ({
          areaId,
          cards: cards.map((card) => ({
            description: card.description,
            dueToday: dueToday.has(card.skillId),
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
    },
    status: "ready",
  };
}
