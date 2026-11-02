/** The setup lessons a tool choice needs written; `userId` comes from the capability that asked. */
export type SetupLessonWriting = {
  goalId: string;
  language: string;
  system: string;
  tools: { name: string; ownerId: string | null }[];
  userId: string;
};

/** One run writes a selection at a time, so the same choice sent again joins it. */
export function getSetupLessonWritingKey({ language, system, tools }: SetupLessonWriting): string {
  const names = tools.map((tool) => `${tool.ownerId ?? "shared"}:${tool.name}`).toSorted();
  return `setup:${language}:${system}:${names.join("|")}`;
}
