"use client";

import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import {
  carryUsageDataChoiceToAccount,
  readBrowserUsageData,
  readRequestCountry,
  readUsageDataCookie,
  rememberUsageDataChoice,
  subscribeToUsageData,
} from "@/lib/usage-data/usage-data-choice";
import { USAGE_NOTICE_ATTRIBUTE } from "@/lib/usage-data/usage-notice-script";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import {
  isSharingUsageData,
  startPostHog,
  stopPostHog,
} from "@zoonk/core/analytics/posthog-browser";
import { RegisterSharedEventProperties } from "@zoonk/core/analytics/register-shared-properties";
import { buildSharedEventProperties } from "@zoonk/core/analytics/shared-properties";
import {
  getUsageDataChoice,
  parseUsageDataCookie,
  resolveUsageDataSharing,
} from "@zoonk/utils/usage-data";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { PostHogIdentify } from "./posthog-identify";

/** Null until the summary is read: analytics stay off rather than count someone as somebody else. */
function getAnalyticsViewer({ learner, locale }: { learner: LearnerSummaryState; locale: string }) {
  if (learner.status === "visitor") {
    return {
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

  const { analytics, identity } = learner.summary;

  return {
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
 * browser reads only while nobody has chosen. PostHog never starts on a guess.
 */
function useUsageDataSharing(account: boolean | null): boolean | null | undefined {
  // Null during the server's render and hydration, which know neither cookie.
  const browser = useSyncExternalStore(subscribeToUsageData, readBrowserUsageData, () => null);

  const choice = browser
    ? getUsageDataChoice({ account, browser: parseUsageDataCookie(browser.choice) })
    : null;

  const countryNeeded = browser !== null && choice === null && !browser.country;

  useEffect(() => {
    if (countryNeeded) {
      readRequestCountry();
    }
  }, [countryNeeded]);

  if (!browser || countryNeeded) {
    return undefined;
  }

  return resolveUsageDataSharing({ choice, country: browser.country });
}

function UsageDataSharing({
  account,
  share,
  signedIn,
}: {
  account: boolean | null;
  share: boolean | null;
  signedIn: boolean;
}) {
  useEffect(() => {
    document.documentElement.toggleAttribute(USAGE_NOTICE_ATTRIBUTE, share === null);

    const browser = parseUsageDataCookie(readUsageDataCookie());

    if (account !== null && browser === null) {
      void rememberUsageDataChoice(account);
    }

    // A "no" in this browser wins over the account's, so its other devices and the server stop too.
    if (signedIn && (account === null || (browser === false && account))) {
      void carryUsageDataChoiceToAccount();
    }

    void (share ? startPostHog() : stopPostHog());
  }, [account, share, signedIn]);

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
  const share = useUsageDataSharing(viewer?.shareUsageData ?? null);

  if (!viewer || share === undefined) {
    return null;
  }

  return (
    <>
      <UsageDataSharing
        account={viewer.shareUsageData}
        share={share}
        signedIn={viewer.userId !== null}
      />
      <RegisterSharedEventProperties properties={viewer.properties} />
      {share && (
        <PostHogIdentify
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
