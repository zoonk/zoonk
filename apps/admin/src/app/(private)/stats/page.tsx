import { type Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Stats" };

export default function StatsPage() {
  redirect("/stats/engagement?view=active-learners");
}
