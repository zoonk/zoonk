import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { StartContent } from "./start-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Start online courses to learn languages and more on Zoonk. Practice language learning, learn English or Spanish, and create AI-powered courses for any subject.",
    ),
    title: t("Online Courses to Learn Languages and More"),
  };
}

/**
 * Hosts the new goal picker that replaces the old single `/learn` entry point.
 */
export default function Start() {
  return <StartContent />;
}
