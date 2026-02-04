import { type StepKind, type StepVisualKind, prisma } from "@zoonk/db";

export async function stepFixture(attrs: {
  activityId: bigint;
  content?: { text: string; title: string };
  kind?: StepKind;
  position?: number;
  visualContent?: object;
  visualKind?: StepVisualKind;
}) {
  const step = await prisma.step.create({
    data: {
      activityId: attrs.activityId,
      content: attrs.content ?? { text: "Test step content", title: "Test Step" },
      kind: attrs.kind ?? "static",
      position: attrs.position ?? 0,
      visualContent: attrs.visualContent,
      visualKind: attrs.visualKind,
    },
  });
  return step;
}
