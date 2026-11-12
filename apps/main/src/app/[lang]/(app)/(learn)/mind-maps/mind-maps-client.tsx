"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { MindMapsScreen } from "@zoonk/learn/mind-maps";
import { type MindMapsPage } from "@zoonk/learn/mind-maps/page";
import { readMindMapTab } from "@zoonk/learn/mind-maps/urls";
import { useSearchParams } from "next/navigation";

const HREFS = { back: "/plan", page: "/mind-maps", study: "/mind-maps/study" };

export function MindMapsClient({
  mindMaps,
  tier,
}: {
  mindMaps: MindMapsPage;
  tier: EntitlementTier;
}) {
  const actions = useMindMapActions(mindMaps.goal.id);
  const query = useSearchParams();

  return (
    <MindMapsScreen
      actions={actions}
      hrefs={HREFS}
      mindMaps={mindMaps}
      subject={query.get("subject")}
      tab={readMindMapTab(query.get("tab"))}
      tier={tier}
    />
  );
}
