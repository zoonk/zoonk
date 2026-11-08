import { refreshOwedStudyDay } from "@zoonk/core/sessions/refresh-owed-day";

export async function refreshStudyDayStep(
  input: Parameters<typeof refreshOwedStudyDay>[0],
): Promise<void> {
  "use step";
  await refreshOwedStudyDay(input);
}
