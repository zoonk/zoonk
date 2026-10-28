import { getBossQuestionSkills } from "../../checkpoints/checkpoint-minutes";
import { getBossSkillIds } from "../../checkpoints/checkpoint-rules";
import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { toBossPlan } from "./boss-plan";
import { type BossSizes } from "./boss-sizes";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { placeExamBosses } from "./exam-boss-days";
import { toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";

export type SelectedItemFacts = {
  minutes: number;
  parts: { checkpoint: number; practice: number; unwritten: number; written: number };
  skillIds: string[];
  teachingEnd?: string;
  days?: [string, number, number][];
  boss?: {
    kind: "call" | "recording" | "text";
    minutes: number;
    questions: number | null;
    testedKeys: string[];
    testedSkillIds: string[];
    waiting: boolean;
  };
};

const LEARN_KINDS = new Set<PlannedItem["kind"]>(["chapter", "lesson"]);

function listLessonRaw(input: BuildPlanInput): Map<string, number> {
  return new Map(
    [...input.lessons, ...(input.quickLessons?.values() ?? [])].map((lesson) => [
      lesson.lessonId,
      lesson.minutes * input.paceFactor,
    ]),
  );
}

function sumValues(values: Iterable<number>): number {
  return [...values].reduce((sum, value) => sum + value, 0);
}

function splitMinutes({
  built,
  item,
  lessonRaw,
}: {
  built: BuiltPlan;
  item: PlannedItem;
  lessonRaw: ReadonlyMap<string, number>;
}): SelectedItemFacts["parts"] {
  const none = { checkpoint: 0, practice: 0, unwritten: 0, written: 0 };

  if (item.kind === "review") {
    return { ...none, practice: item.minutes };
  }

  if (!LEARN_KINDS.has(item.kind)) {
    return { ...none, checkpoint: item.minutes };
  }

  const portions = built.lessonRawMinutes.get(item.key);
  const raw = portions ? sumValues(portions.values()) : (lessonRaw.get(item.lessonId ?? "") ?? 0);
  const work = Math.min(raw, item.minutes);
  const written = item.lessonId !== null || item.kind === "chapter";

  return {
    ...none,
    practice: item.minutes - work,
    unwritten: written ? 0 : work,
    written: written ? work : 0,
  };
}

function getBossKind({
  goalKind,
  listeningSkillIds,
  skillIds,
}: {
  goalKind: BuildPlanInput["goal"]["kind"];
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): NonNullable<SelectedItemFacts["boss"]>["kind"] {
  if (goalKind === "language") {
    return "call";
  }

  return getBossQuestionSkills({ listeningSkillIds, skillIds }).recordings ? "recording" : "text";
}

function listDays({
  built,
  key,
}: {
  built: BuiltPlan;
  key: string;
}): [string, number, number][] | undefined {
  const study = built.lessonDayMinutes.get(key);
  const raw = built.lessonRawMinutes.get(key);

  if (!study || study.size < 2) {
    return undefined;
  }

  return [...study]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => [date, minutes, raw?.get(date) ?? 0]);
}

export function listSelectedItemFacts({
  built,
  input,
}: {
  built: BuiltPlan & { bossSizes: BossSizes };
  input: BuildPlanInput;
}): Map<string, SelectedItemFacts> {
  const facts = input.bossFacts;
  const lessonRaw = listLessonRaw(input);

  const plan = toBossPlan({
    input,
    items: built.items,
    rows: facts?.rows,
    skillLessons: built.skillLessons,
    survivors: facts?.survivors,
  });

  const placed = placeExamBosses({ built, input, rows: facts?.rows, survivors: facts?.survivors });

  const listTested = (boss: (typeof plan.items)[number]) =>
    placed.get(boss.key)?.tested ??
    (boss.status === "todo" ? [] : (readSelectedItemFacts(boss.facts)?.boss?.testedKeys ?? []));

  const toBoss = (boss: (typeof plan.items)[number]): SelectedItemFacts["boss"] => {
    const sized = built.bossSizes.get(boss.key);
    const testedSkillIds = sized?.skillIds ?? getBossSkillIds({ ...plan, boss });

    return {
      kind: getBossKind({
        goalKind: input.goal.kind,
        listeningSkillIds: facts?.listeningSkillIds ?? new Set(),
        skillIds: testedSkillIds,
      }),
      minutes: boss.minutes,
      questions: sized?.size?.questions ?? null,
      testedKeys: [...listTested(boss)],
      testedSkillIds,
      waiting: sized !== undefined && sized.size === null,
    };
  };

  return new Map(
    plan.items.map((item) => {
      const end = built.teachingEnds.get(item.key);

      const teachingEnd =
        end && item.scheduledFor && end > item.scheduledFor ? toIsoDate(end) : undefined;

      const days = LEARN_KINDS.has(item.kind) ? listDays({ built, key: item.key }) : undefined;

      return [
        item.key,
        {
          minutes: item.minutes,
          parts: splitMinutes({ built, item, lessonRaw }),
          skillIds: plan.itemSkillIds.get(item.key) ?? (item.skillId ? [item.skillId] : []),
          ...(teachingEnd && { teachingEnd }),
          ...(days && { days }),
          ...(item.kind === "boss" && { boss: toBoss(item) }),
        },
      ];
    }),
  );
}
