import { type StepKind, prisma } from "@zoonk/db";

export async function stepFixture(attrs: {
  content?: object;
  isPublished?: boolean;
  kind?: StepKind;
  lessonId?: string;
  position?: number;
  sentenceId?: string;
  wordId?: string;
}) {
  const step = await prisma.step.create({
    data: {
      content: attrs.content ?? { text: "Test step content", title: "Test Step" },
      isPublished: attrs.isPublished,
      kind: attrs.kind ?? "static",
      lessonId: attrs.lessonId ?? "",
      position: attrs.position ?? 0,
      sentenceId: attrs.sentenceId,
      wordId: attrs.wordId,
    },
  });
  return step;
}
