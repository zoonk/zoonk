import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Your answers shape your examples and your buddy. Everything is optional."),
    robots: { follow: false, index: false },
    title: t("About you"),
  };
}

/** The list is the layout's: it stays while a question opens beside it. */
export default function AboutYouPage() {
  return null;
}
