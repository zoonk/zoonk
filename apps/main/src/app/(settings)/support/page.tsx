import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { SupportContent } from "./support-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Get help with your account, courses, or any technical issues. Our support team is here to assist you.",
    ),
    title: t("Help & Support"),
  };
}

export default async function Support() {
  return <SupportContent />;
}
