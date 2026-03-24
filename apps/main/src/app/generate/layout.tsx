import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Creating content") };
}

export default function GenerateLayout({ children }: LayoutProps<"/generate">) {
  return children;
}
