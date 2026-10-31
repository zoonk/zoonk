"use client";

import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import {
  carryUsageDataChoiceToAccount,
  forgetMinorBrowser,
  readBrowserUsageData,
  readRequestCountry,
  readUsageDataCookie,
  rememberMinorBrowser,
  rememberUsageDataChoice,
  subscribeToUsageData,
} from "@/lib/usage-data/usage-data-choice";
import { USAGE_NOTICE_ATTRIBUTE } from "@/lib/usage-data/usage-notice-script";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import {
  type AnalyticsAge,
  isSharingUsageData,
  startPostHog,
  stopPostHog,
} from "@zoonk/core/analytics/posthog-browser";
import { RegisterSharedEventProperties } from "@zoonk/core/analytics/register-shared-properties";
import { buildSharedEventProperties } from "@zoonk/core/analytics/shared-properties";
import {
  USAGE_DATA_MINOR_COOKIE,
  getUsageDataChoice,
  isUsageDataLockedOff,
  parseUsageDataCookie,
  resolveUsageDataSharing,
} from "@zoonk/utils/usage-data";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { PostHogIdentify } from "./posthog-identify";

function getAnalyticsAge({
  adult,
  needsBirthYear,
}: {
  adult: boolean;
  needsBirthYear: boolean;
}): AnalyticsAge {
  if (adult) {
    return "adult";
  }

  return needsBirthYear ? null : "minor";
}

/** Null until the summary is read: analytics stay off rather than count someone as somebody else. */
function getAnalyticsViewer({ learner, locale }: { learner: LearnerSummaryState; locale: string }) {
  if (learner.status === "visitor") {
    return {
      age: null,
      disabled: false,
      plan: "free",
      properties: buildSharedEventProperties({ isGuest: true, locale, platform: "web" }),
      shareUsageData: null,
      userId: null,
      username: null,
    };
  }

  if (learner.status !== "ready") {
    return null;
  }

  const { analytics, identity, needsBirthYear } = learner.summary;

  return {
    age: getAnalyticsAge({ adult: analytics.adult, needsBirthYear }),
    disabled: analytics.disabled,
    plan: analytics.plan,
    properties: buildSharedEventProperties({
      goal: analytics.goal,
      isGuest: false,
      locale,
      platform: "web",
    }),
    shareUsageData: analytics.shareUsageData,
    userId: identity.userId,
    username: analytics.username,
  };
}

/**
 * true shares, false doesn't, null asks (the notice), undefined waits for the country, which the
 * browser reads only while nobody has chosen, or a minor said yes. PostHog never starts on a guess.
 */
function useUsageDataSharing({
  account,
  minor,
}: {
  account: boolean | null;
  minor: boolean;
}): { lockedOff: boolean; share: boolean | null } | undefined {
  // Null during the server's render and hydration, which know neither cookie.
  const browser = useSyncExternalStore(subscribeToUsageData, readBrowserUsageData, () => null);

  const choice = browser
    ? getUsageDataChoice({ account, browser: parseUsageDataCookie(browser.choice) })
    : null;

  const countryNeeded =
    browser !== null && !browser.country && (choice === null || (minor && choice));

  useEffect(() => {
    if (!countryNeeded) {
      return;
    }

    readRequestCountry();

    // A minor's yes may not count where they are, so what it started stops until the country says.
    if (minor && choice) {
      void stopPostHog();
    }
  }, [choice, countryNeeded, minor]);

  if (!browser || countryNeeded) {
    return undefined;
  }

  return {
    lockedOff: isUsageDataLockedOff({ country: browser.country, minor }),
    share: resolveUsageDataSharing({ choice, country: browser.country, minor }),
  };
}

/**
 * A minor's browser where they can't say yes keeps a mark instead of their choice, so the notice
 * stays hidden from the first paint and nothing they chose goes with their account. Once the mark
 * no longer applies (they're an adult, or someone else uses the browser), it goes, so the notice
 * asks from the first paint again.
 */
function UsageDataSharing({
  account,
  age,
  lockedOff,
  share,
  signedIn,
}: {
  account: boolean | null;
  age: AnalyticsAge;
  lockedOff: boolean;
  share: boolean | null;
  signedIn: boolean;
}) {
  useEffect(() => {
    document.documentElement.toggleAttribute(USAGE_NOTICE_ATTRIBUTE, share === null);

    const cookie = readUsageDataCookie();
    const browser = parseUsageDataCookie(cookie);

    if (lockedOff) {
      if (cookie !== USAGE_DATA_MINOR_COOKIE && browser !== false) {
        void rememberMinorBrowser();
      }
    } else {
      if (account !== null && browser === null) {
        void rememberUsageDataChoice(account);
      } else if (cookie === USAGE_DATA_MINOR_COOKIE) {
        void forgetMinorBrowser();
      }

      if (signedIn && account === null) {
        void carryUsageDataChoiceToAccount({ withYes: true });
      }
    }

    void (share ? startPostHog({ age }) : stopPostHog());
  }, [account, age, lockedOff, share, signedIn]);

  return null;
}

/** Vercel's script stays after `<Analytics>` unmounts and still sends `track()` events, so it asks each time. */
function keepWhileSharing(event: BeforeSendEvent): BeforeSendEvent | null {
  return isSharingUsageData() ? event : null;
}

/** Reads the learner summary in the browser, so no page's render reads who is looking. */
export function AppAnalytics({ locale }: { locale: string }) {
  const learner = useLearnerSummary();
  const viewer = useMemo(() => getAnalyticsViewer({ learner, locale }), [learner, locale]);

  const sharing = useUsageDataSharing({
    account: viewer?.shareUsageData ?? null,
    minor: viewer?.age === "minor",
  });

  if (!viewer || !sharing) {
    return null;
  }

  const { lockedOff, share } = sharing;

  return (
    <>
      <UsageDataSharing
        account={viewer.shareUsageData}
        age={viewer.age}
        lockedOff={lockedOff}
        share={share}
        signedIn={viewer.userId !== null}
      />
      <RegisterSharedEventProperties properties={viewer.properties} />
      {share && (
        <PostHogIdentify
          adult={viewer.age === "adult"}
          analyticsDisabled={viewer.disabled}
          plan={viewer.plan}
          userId={viewer.userId}
          username={viewer.username}
        />
      )}
      {share && !viewer.disabled ? <Analytics beforeSend={keepWhileSharing} debug={false} /> : null}
    </>
  );
}
