import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { SupportContent } from "./support-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Share feedback, ask questions, or get help with your account and courses."),
    title: t("Feedback & Support"),
  };
}

export default async function Support() {
  return <SupportContent />;
}
