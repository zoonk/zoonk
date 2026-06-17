import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { LearnContent } from "./learn-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Tell Zoonk what you want to learn and get a course created with AI. Start learning any subject with interactive lessons.",
    ),
    title: t("Learn Anything with AI"),
  };
}

/**
 * Keeps `/learn` as a thin route wrapper because the same goal form is also
 * the empty state on `/`.
 */
export default function Learn() {
  return <LearnContent />;
}
