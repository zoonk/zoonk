import { type Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Stats" };

/**
 * Stats is now one continuous explorer, so the section index opens the most
 * useful default analysis instead of asking admins to choose a category first.
 */
export default function StatsPage() {
  redirect("/stats/engagement?view=active-learners");
}
