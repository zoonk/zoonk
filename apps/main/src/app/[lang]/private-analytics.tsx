"use client";

import { filterVercelEvent } from "@/lib/analytics-privacy";
import { Analytics } from "@vercel/analytics/next";

export function PrivateAnalytics() {
  return <Analytics beforeSend={filterVercelEvent} debug={false} />;
}
