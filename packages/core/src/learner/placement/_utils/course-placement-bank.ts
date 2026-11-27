import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { type GoalPlan, loadCoursePlacementPlan } from "../../_utils/goal-skill-graph";
import { isLowGuessTap } from "../../_utils/placement-guess-rate";
import { loadWritingSkillIds } from "../../writing-skills";
import {
  COURSE_QUESTION_LIMIT,
  courseOpeningPosition,
  courseProbePositions,
} from "../course-search";
import { getOwnLevel } from "../placement-contract";
import { getTopicsAhead } from "./placement-attempt-record";
import { loadPlacementItems } from "./placement-bank-items";
import { loadSeenPlacementItems } from "./placement-evidence";

const MIN_READY_PROBES = 4;

export async function readCourseProbes(
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "userId">,
  tx: TransactionClient = prisma,
  savedPlan?: GoalPlan,
) {
  const [plan, writing, listening] = await readDatabaseFacts(
    tx,
    () => savedPlan ?? loadCoursePlacementPlan(goal.id, { tx }),
    () => loadWritingSkillIds(goal.id, tx),
    () => loadListeningSkillIds(goal.id, tx),
  );

  const ahead = getTopicsAhead(plan);
  const eligible = ahead.filter((skill) => !writing.has(skill.id) && !listening.has(skill.id));
  const positions = courseProbePositions(eligible.length);
  const ids = positions.flatMap((index) => eligible[index]?.id ?? []);
  const position = courseOpeningPosition(getOwnLevel({ goal }));
  const target = position * (ahead.length - 1);

  const opening = ahead
    .filter((topic) => ids.includes(topic.id))
    .toSorted(
      (a, b) => Math.abs(ahead.indexOf(a) - target) - Math.abs(ahead.indexOf(b) - target),
    )[0];

  const prioritySkillIds = [
    ...new Set([...ids.slice(0, COURSE_QUESTION_LIMIT), ...(opening ? [opening.id] : [])]),
  ];

  const possible = ahead.slice(0, -1).some((topic) => eligible.includes(topic));
  return { ahead, eligible, ids, opening, plan, position, possible, prioritySkillIds };
}

export async function readCourseBank(
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "userId">,
  tx: TransactionClient = prisma,
) {
  const { ahead, eligible, ids, opening, plan, position, possible } = await readCourseProbes(
    goal,
    tx,
  );

  const rows = await loadPlacementItems({
    examBlueprintId: goal.examBlueprintId,
    skillIds: ids,
    tx,
    userId: goal.userId,
  });

  const items = rows.filter((item) => isLowGuessTap(item));

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
      askable: eligible.some((topic) => topic.id === skill.id),
      chapter: skill.areaTitle || skill.sectionTitle || skill.topicTitle || null,
      id: skill.id,
      itemIds: first && second ? [first.id, second.id] : [],
      lessons:
        plan.items.filter((item) => item.status === "todo" && item.skillIds.includes(skill.id))
          .length || 1,
      sectionTitle: skill.sectionTitle,
    };
  });

  const probes = topics.filter((topic) => ids.includes(topic.id));
  const index = probes.findIndex((topic) => topic.id === opening?.id);
  const neighbors = probes.slice(Math.max(0, index - 1), index + 2);

  const ready =
    possible &&
    index !== -1 &&
    neighbors.every((topic) => topic.itemIds.length === 2) &&
    topics.filter((topic) => topic.itemIds.length === 2).length >=
      Math.min(MIN_READY_PROBES, eligible.length);

  return { ids, position, possible, ready, topics };
}
