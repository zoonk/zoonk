import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getStudyReminderForAdmin } from "@zoonk/core/reminders/get";

export const getUserStudyReminder = cacheAdminData(getStudyReminderForAdmin);
