import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { loadCoursePlacementPlan } from "../../_utils/goal-skill-graph";
import { isLowGuessTap } from "../../_utils/placement-guess-rate";
import { loadWritingSkillIds } from "../../writing-skills";
import { courseOpeningPosition, courseProbePositions } from "../course-search";
import { getOwnLevel } from "../placement-contract";
import { getTopicsAhead } from "./placement-attempt-record";
import { loadPlacementItems } from "./placement-bank-items";
import { loadSeenPlacementItems } from "./placement-evidence";

export async function readCourseBank(
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "userId">,
  tx: TransactionClient = prisma,
) {
  const [plan, writing, listening] = await Promise.all([
    loadCoursePlacementPlan(goal.id, { tx }),
    loadWritingSkillIds(goal.id, tx),
    loadListeningSkillIds(goal.id, tx),
  ]);
  const ahead = getTopicsAhead(plan);
  const eligible = ahead.filter((skill) => !writing.has(skill.id) && !listening.has(skill.id));
  const positions = courseProbePositions(eligible.length);
  const ids = positions.flatMap((index) => eligible[index]?.id ?? []);
  const items = (
    await loadPlacementItems({
      examBlueprintId: goal.examBlueprintId,
      skillIds: ids,
      userId: goal.userId,
      tx,
    })
  ).filter(isLowGuessTap);
  const seen = await loadSeenPlacementItems({
    itemIds: items.map((item) => item.id),
    tx,
    userId: goal.userId,
  });
  const available = Map.groupBy(
    items.filter((item) => !seen.has(item.id)),
    (item) => item.skillId,
  );
  const topics = ahead.map((skill) => {
    const pool = available.get(skill.id) ?? [];
    const first = pool[0];
    const second = pool.find((item) => item.format !== first?.format) ?? pool[1];
    return {
      askable: !writing.has(skill.id) && !listening.has(skill.id),
      chapter: skill.areaTitle || skill.sectionTitle,
      id: skill.id,
      itemIds: first && second ? [first.id, second.id] : [],
      lessons:
        plan.items.filter((item) => item.status === "todo" && item.skillIds.includes(skill.id))
          .length || 1,
      sectionTitle: skill.sectionTitle,
    };
  });
  const position = courseOpeningPosition(getOwnLevel({ goal }));
  const groups = [...Map.groupBy(topics, (topic) => topic.sectionTitle).values()];
  const area =
    groups.toSorted(
      (left, right) =>
        right.reduce((sum, t) => sum + t.lessons, 0) - left.reduce((sum, t) => sum + t.lessons, 0),
    )[0] ?? [];
  const probes = area.filter((topic) => ids.includes(topic.id));
  const target = position * (area.length - 1);
  const first = probes.toSorted(
    (left, right) => Math.abs(area.indexOf(left) - target) - Math.abs(area.indexOf(right) - target),
  )[0];
  const index = first ? probes.indexOf(first) : -1;
  const neighbors = probes.slice(Math.max(0, index - 1), index + 2);
  const possible = topics.slice(0, -1).some((topic) => topic.askable);
  const ready =
    possible &&
    index >= 0 &&
    neighbors.every((topic) => topic.itemIds.length === 2) &&
    topics.filter((topic) => topic.itemIds.length === 2).length >= Math.min(4, eligible.length);
  return { ids, position, possible, ready, topics };
}
