import {
  type LessonDraftState,
  checkLessonContent,
  fixLessonContent,
  writeLessonContent as writeDraft,
} from "../library/lessons/write-lesson-content";

export async function writeLessonContent(input: Parameters<typeof writeDraft>[0]) {
  const result = await writeDraft(input);

  if (result.status !== "drafted") {
    return result;
  }

  return checkDraft(result.draft);

  async function checkDraft(
    draft: LessonDraftState,
  ): Promise<Exclude<Awaited<ReturnType<typeof checkLessonContent>>, { status: "needsFix" }>> {
    const checked = await checkLessonContent({ ...input, draft });
    return checked.status === "needsFix" ? checkDraft(await fixLessonContent(checked)) : checked;
  }
}
