import { type StepKind, prisma } from "@zoonk/db";

export async function stepFixture(attrs: {
  activityId: string;
  content?: object;
  isPublished?: boolean;
  kind?: StepKind;
  position?: number;
  sentenceId?: string;
  wordId?: string;
}) {
  const step = await prisma.step.create({
    data: {
      activityId: attrs.activityId,
      content: attrs.content ?? { text: "Test step content", title: "Test Step" },
      isPublished: attrs.isPublished,
      kind: attrs.kind ?? "static",
      position: attrs.position ?? 0,
      sentenceId: attrs.sentenceId,
      wordId: attrs.wordId,
    },
  });
  return step;
}
