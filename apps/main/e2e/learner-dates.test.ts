import { type Browser, type Locator, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated, holdScripts } from "@zoonk/e2e/hydration";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { addIsoDays, getIsoDay } from "@zoonk/utils/calendar-day";
import { MS_PER_HOUR } from "@zoonk/utils/date";
import { formatIsoDate, isoDateToUtc } from "@zoonk/utils/date-format";
import { isJsonObject } from "@zoonk/utils/json";
import { getLocalTimeZone, getTimeZoneOffsetMs } from "@zoonk/utils/time-zone";
import { expect, test } from "./fixtures";
import { ANSWERED } from "./onboarding-fixtures";
import { DAYS_TO_EXAM, createStudyDay } from "./study-day";

/**
 * 26 hours apart, so one of them is always on another day than any other zone. Each note is saved
 * at an hour when UTC and every zone between the two are on another day than the device.
 */
const FAR_ZONES = [
  { hour: 2, timeZone: "Pacific/Kiritimati" },
  { hour: 22, timeZone: "Etc/GMT+12" },
] as const;

const TIME_ZONE_COOKIE = "tz";

type Device = (typeof FAR_ZONES)[number];

function todayIn(timeZone: string): string {
  return getIsoDay({ now: new Date(), timeZone });
}

function deviceOnAnotherDayThan(timeZone: string): Device {
  const device = FAR_ZONES.find((zone) => todayIn(zone.timeZone) !== todayIn(timeZone));

  if (!device) {
    throw new Error(`Both far zones are on ${timeZone}'s day`);
  }

  return device;
}

function isHydrationError(text: string): boolean {
  return /hydrat|#418|#423|#425/iu.test(text);
}

/** A recoverable hydration error re-renders the page in the browser and drops what was pressed. */
function watchHydrationErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("pageerror", (error) => {
    if (isHydrationError(error.message)) {
      errors.push(error.message);
    }
  });

  page.on("console", (message) => {
    if (message.type() === "error" && isHydrationError(message.text())) {
      errors.push(message.text());
    }
  });

  return errors;
}

async function openIn({
  browser,
  device,
  user,
  withCookie,
}: {
  browser: Browser;
  device: Device;
  user: E2EUser;
  withCookie: boolean;
}): Promise<Page> {
  const context = await browser.newContext({
    storageState: user.storageState,
    timezoneId: device.timeZone,
  });

  if (withCookie) {
    await context.addCookies([
      { name: TIME_ZONE_COOKIE, url: getBaseURL(), value: device.timeZone },
    ]);
  }

  return context.newPage();
}

/** The server's words, read before any script runs, then the hydrated page's. */
async function readBeforeAndAfterHydration({
  page,
  path,
  target,
}: {
  page: Page;
  path: string;
  target: (page: Page) => Locator;
}) {
  const errors = watchHydrationErrors(page);
  const release = await holdScripts(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(target(page).first()).toBeVisible();
  const server = await target(page).allInnerTexts();

  await release();
  await expectHydrated(target(page).first());

  return { errors, hydrated: await target(page).allInnerTexts(), server };
}

async function createRevealDay() {
  const { goal, user } = await createStudyDay();
  const details = isJsonObject(goal.details) ? goal.details : {};
  const setup = Array.isArray(details.answered) ? details.answered : [];

  await prisma.goal.update({
    data: { details: { ...details, answered: [...setup, ...ANSWERED] }, planRevealedAt: null },
    where: { id: goal.id },
  });

  return { goal, user };
}

/** The device's yesterday at `device.hour`, as an instant. */
function savedYesterdayOn(device: Device): { day: string; savedAt: Date } {
  const day = addIsoDays({ day: todayIn(device.timeZone), days: -1 });
  const wallClock = isoDateToUtc(day).getTime() + device.hour * MS_PER_HOUR;
  const offset = getTimeZoneOffsetMs({ date: new Date(wallClock), timeZone: device.timeZone });

  return { day, savedAt: new Date(wallClock - offset) };
}

const SCENARIOS = [
  // The zone the browser wrote is the one the server draws in, whatever the server's own zone.
  { name: "with the zone cookie", serverZone: getLocalTimeZone(), withCookie: true },
  // With no cookie and no Vercel header, the server draws in UTC until the browser writes one.
  { name: "without the zone cookie", serverZone: "UTC", withCookie: false },
] as const;

// The device is picked inside each test: picked at load, its zone in a title could differ between
// Playwright listing the tests and a worker running them.
for (const { name, serverZone, withCookie } of SCENARIOS) {
  test.describe(`Learner dates ${name}`, () => {
    test("the plan reveal hydrates with the server's day count", async ({ browser }) => {
      const device = deviceOnAnotherDayThan(serverZone);
      const { goal, user } = await createRevealDay();
      const page = await openIn({ browser, device, user, withCookie });

      const { errors, hydrated, server } = await readBeforeAndAfterHydration({
        page,
        path: `/start/${goal.id}`,
        target: (current) =>
          current.getByText("until the exam").filter({ visible: true }).locator(".."),
      });

      expect(server.join("\n")).toContain(`${DAYS_TO_EXAM} days`);
      expect(hydrated).toStrictEqual(server);
      expect(errors).toStrictEqual([]);

      const cookies = await page.context().cookies();

      expect(cookies.find((cookie) => cookie.name === TIME_ZONE_COOKIE)?.value).toBe(
        device.timeZone,
      );
    });

    test("a remembered fact hydrates with the server's date", async ({ browser }) => {
      const device = deviceOnAnotherDayThan(serverZone);
      const user = await createE2EUser(getBaseURL());
      const { day, savedAt } = savedYesterdayOn(device);
      await memoryFactFixture({ createdAt: savedAt, userId: user.id });
      const page = await openIn({ browser, device, user, withCookie });

      const { errors, hydrated, server } = await readBeforeAndAfterHydration({
        page,
        path: "/settings/memory",
        target: (current) => current.locator(`time[datetime="${savedAt.toISOString()}"]`),
      });

      expect(hydrated).toStrictEqual(server);
      expect(errors).toStrictEqual([]);

      if (withCookie) {
        expect(server).toStrictEqual([
          formatIsoDate({ isoDate: day, locale: "en", today: todayIn(device.timeZone) }),
        ]);
      }
    });
  });
}
