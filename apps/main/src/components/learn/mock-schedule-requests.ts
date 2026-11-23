import { getFromBrowser, sendFromBrowser } from "@/lib/api/browser-api";
import {
  mockScheduleChangeSchema,
  mockScheduleOptionsSchema,
} from "@zoonk/core/checkpoints/mock-schedule-contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

function schedulePath(id: string) {
  return `/v1/challenges/${encodeURIComponent(id)}/schedule` as const;
}

function zoneSearch() {
  return new URLSearchParams({ timeZone: getLocalTimeZone() }).toString();
}

export async function dates(id: string): Promise<string[] | null> {
  const response = await getFromBrowser(`${schedulePath(id)}?${zoneSearch()}`);

  if (!response?.ok) {
    return null;
  }

  const value = mockScheduleOptionsSchema.safeParse(await response.json());
  return value.data?.dates ?? null;
}

export async function change(id: string, date: string | null): Promise<string | null> {
  const response = await sendFromBrowser({
    body: { date, timeZone: getLocalTimeZone() },
    method: "POST",
    path: schedulePath(id),
  });

  if (!response?.ok) {
    return null;
  }

  const value = mockScheduleChangeSchema.safeParse(await response.json());
  return value.data?.changeId ?? null;
}

export async function undo(id: string, changeId: string): Promise<boolean> {
  const response = await sendFromBrowser({
    method: "DELETE",
    path: `${schedulePath(id)}/${encodeURIComponent(changeId)}?${zoneSearch()}`,
  });

  return Boolean(response?.ok);
}
