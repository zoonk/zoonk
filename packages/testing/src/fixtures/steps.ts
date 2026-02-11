import { type StepKind, type StepVisualKind, prisma } from "@zoonk/db";

export async function stepFixture(attrs: {
  activityId: bigint;
  content?: object;
  kind?: StepKind;
  position?: number;
  sentenceId?: bigint;
  visualContent?: object;
  visualKind?: StepVisualKind;
  wordId?: bigint;
}) {
  const step = await prisma.step.create({
    data: {
      activityId: attrs.activityId,
      content: attrs.content ?? { text: "Test step content", title: "Test Step" },
      kind: attrs.kind ?? "static",
      position: attrs.position ?? 0,
      sentenceId: attrs.sentenceId,
      visualContent: attrs.visualContent,
      visualKind: attrs.visualKind,
      wordId: attrs.wordId,
    },
  });
  return step;
}
