"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { MindMapsScreen } from "@zoonk/learn/mind-maps";
import { type MindMapsPage } from "@zoonk/learn/mind-maps/page";
import { type MindMapTab } from "@zoonk/learn/mind-maps/urls";

const HREFS = { back: "/plan", page: "/mind-maps", study: "/mind-maps/study" };

export function MindMapsClient({
  mindMaps,
  subject,
  tab,
  tier,
}: {
  mindMaps: MindMapsPage;
  subject: string | null;
  tab: MindMapTab | null;
  tier: EntitlementTier;
}) {
  const actions = useMindMapActions(mindMaps.goal.id);

  return (
    <MindMapsScreen
      actions={actions}
      hrefs={HREFS}
      mindMaps={mindMaps}
      subject={subject}
      tab={tab}
      tier={tier}
    />
  );
}
