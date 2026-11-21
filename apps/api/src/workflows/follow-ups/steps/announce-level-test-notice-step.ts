import { announcePendingLevelTestSkips } from "@zoonk/core/language/level-test/announce-pending";

export async function announceLevelTestNoticeStep(
  input: Parameters<typeof announcePendingLevelTestSkips>[0],
) {
  "use step";
  await announcePendingLevelTestSkips(input);
}
