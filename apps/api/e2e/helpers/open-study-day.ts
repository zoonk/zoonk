import { type APIRequestContext } from "@playwright/test";
import { expect } from "@zoonk/e2e/fixtures";
import { openedStudyDayResponseSchema } from "../../src/lib/openapi/schemas/open-study-day";
import { todayResponseSchema } from "../../src/lib/openapi/schemas/today";
import { readBody } from "./response";

const EXISTING_DAY = 200;
const CREATED_DAY = 201;

export async function openStudyDay({
  api,
  goalId,
  timeZone = "UTC",
}: {
  api: APIRequestContext;
  goalId: string;
  timeZone?: string;
}) {
  const today = await readBody({
    response: await api.get(`/v1/today?goalId=${goalId}&timeZone=${encodeURIComponent(timeZone)}`),
    schema: todayResponseSchema,
  });

  const response = await api.post(`/v1/goals/${goalId}/study-sessions`, {
    data: { keepEmpty: true, shownDate: today.session.localDate, timeZone },
  });

  expect([EXISTING_DAY, CREATED_DAY], await response.text()).toContain(response.status());
  const opened = openedStudyDayResponseSchema.parse(await response.json());
  return opened.session;
}
