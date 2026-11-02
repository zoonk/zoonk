import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { SupportContent } from "./support-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Ask a question, report a problem or share an idea. We answer by email."),
    title: t("Help"),
  };
}

export default async function Support() {
  return <SupportContent />;
}
