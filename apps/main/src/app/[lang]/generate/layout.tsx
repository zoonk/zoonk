import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Creating content") };
}

export default function GenerateLayout({ children }: LayoutProps<"/[lang]/generate">) {
  return children;
}
