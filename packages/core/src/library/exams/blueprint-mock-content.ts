import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type ExamStructure, type SectionNavigation } from "./blueprint-contract";
import { type KeptFacts, keptOr } from "./blueprint-kept";

type Extraction = BlueprintExtraction;
type MockConditions = NonNullable<ExamStructure["mock"]>;

function toSectionDetails({
  id,
  kept,
  section,
}: {
  id: string;
  kept: KeptFacts;
  section: NonNullable<Extraction["mock"]>["sections"][number];
}): { breakAfterMinutes?: number; navigation?: SectionNavigation; tools?: string } {
  const breakAfterMinutes = keptOr({
    gap: null,
    id: `${id}.breakAfterMinutes`,
    kept,
    value: section.breakAfterMinutes,
  });

  const tools = keptOr({ gap: null, id: `${id}.tools`, kept, value: section.tools });

  const navigation = keptOr({
    gap: null,
    id: `${id}.navigation`,
    kept,
    value: toNavigation(section),
  });

  return {
    ...(breakAfterMinutes ? { breakAfterMinutes } : {}),
    ...(navigation ? { navigation } : {}),
    ...(tools ? { tools } : {}),
  };
}

function toNavigation(
  section: NonNullable<Extraction["mock"]>["sections"][number],
): SectionNavigation | null {
  const { navigation } = section;

  if (!navigation) {
    return null;
  }

  const rules = {
    answerChanges:
      navigation.forwardOnly && navigation.answerChanges && navigation.answerChanges > 0
        ? navigation.answerChanges
        : null,
    forwardOnly: navigation.forwardOnly,
    itemSeconds:
      navigation.itemSeconds && navigation.itemSeconds > 0 ? navigation.itemSeconds : null,
    mustAnswer: navigation.mustAnswer,
  };

  return rules.forwardOnly || rules.mustAnswer || rules.itemSeconds ? rules : null;
}

function toPlays({
  id,
  kept,
  task,
}: {
  id: string;
  kept: KeptFacts;
  task: { plays: number | null };
}): 1 | 2 | null {
  const plays = keptOr({ gap: null, id: `${id}.plays`, kept, value: task.plays });
  return plays === 1 || plays === 2 ? plays : null;
}

function toSections({ kept, mock }: { kept: KeptFacts; mock: NonNullable<Extraction["mock"]> }) {
  const ids = mock.sections.map((_, index) => `mock.sections.${index}`);

  if (!ids.every((id) => kept.has(id))) {
    return [];
  }

  const daysKept = mock.sections.every(
    (section, index) => section.day === null || kept.has(`${ids[index]}.day`),
  );

  return mock.sections.map((section, index) => ({
    day: daysKept ? section.day : null,
    kind: section.kind,
    minutes: keptOr({ gap: null, id: `${ids[index]}.minutes`, kept, value: section.minutes }),
    name: section.name,
    questions:
      section.kind === "written"
        ? null
        : keptOr({ gap: null, id: `${ids[index]}.questions`, kept, value: section.questions }),
    tasks: (section.tasks ?? []).flatMap((task, taskIndex) => {
      const id = `${ids[index]}.tasks.${taskIndex}`;

      if (task.count <= 0 || !kept.has(id)) {
        return [];
      }

      const plays = toPlays({ id, kept, task });

      const description =
        section.kind === "listening"
          ? keptOr({ gap: "", id: `${id}.description`, kept, value: task.description })
          : task.description;

      return [{ count: task.count, description, ...(plays ? { plays } : {}) }];
    }),
    ...toSectionDetails({ id: ids[index] ?? "", kept, section }),
  }));
}

function toScoring({ kept, mock }: { kept: KeptFacts; mock: NonNullable<Extraction["mock"]> }) {
  const { description, method, relative, scale, wrongPenalty } = mock.scoring;

  if (!kept.has("mock.scoring")) {
    return { description: "", method: "other" as const };
  }

  const penalty =
    method === "wrongCancelsRight" && typeof wrongPenalty === "number"
      ? keptOr({ gap: null, id: "mock.scoring.wrongPenalty", kept, value: wrongPenalty })
      : null;

  return {
    description:
      method === "other"
        ? description
        : keptOr({ gap: "", id: "mock.scoring.description", kept, value: description }),
    method,
    ...(relative && kept.has("mock.scoring.relative") ? { relative: true } : {}),
    ...(penalty === null ? {} : { wrongPenalty: penalty }),
    ...toScale({ kept, scale }),
  };
}

function toScale({
  kept,
  scale,
}: {
  kept: KeptFacts;
  scale: NonNullable<Extraction["mock"]>["scoring"]["scale"];
}): { scale: NonNullable<MockConditions["scoring"]["scale"]> } | null {
  if (!scale || !kept.has("mock.scoring.scale") || scale.max <= scale.min) {
    return null;
  }

  const { fromPercent } = scale;
  const PERCENT = 100;

  const landsOnScale =
    fromPercent !== null &&
    fromPercent.perPercent > 0 &&
    fromPercent.base >= scale.min &&
    fromPercent.base + fromPercent.perPercent * PERCENT <= scale.max;

  return {
    scale: {
      fromPercent: landsOnScale ? fromPercent : null,
      max: scale.max,
      min: scale.min,
      name: scale.name,
      passScore:
        scale.passScore !== null && scale.passScore >= scale.min && scale.passScore <= scale.max
          ? scale.passScore
          : null,
      step: scale.step && scale.step > 0 ? scale.step : null,
    },
  };
}

export function toMock({ extraction, kept }: { extraction: Extraction; kept: KeptFacts }) {
  const { mock } = extraction;
  const citations = [...kept.entries()].find(([id]) => id.startsWith("mock."))?.[1];

  if (!mock || !citations) {
    return null;
  }

  const conditions = {
    adaptive: mock.adaptive && kept.has("mock.adaptive"),
    citations,
    order: keptOr({ gap: null, id: "mock.order", kept, value: mock.order }),
    scoring: toScoring({ kept, mock }),
    sections: toSections({ kept, mock }),
    timeLimitMinutes: keptOr({
      gap: null,
      id: "mock.timeLimitMinutes",
      kept,
      value: mock.timeLimitMinutes,
    }),
    totalQuestions: keptOr({
      gap: null,
      id: "mock.totalQuestions",
      kept,
      value: mock.totalQuestions,
    }),
  } satisfies MockConditions;

  const known =
    kept.has("mock.scoring") ||
    conditions.sections.length > 0 ||
    conditions.timeLimitMinutes !== null ||
    conditions.totalQuestions !== null;

  return known ? conditions : null;
}
