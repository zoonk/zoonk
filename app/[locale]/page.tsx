import { getTranslations, setRequestLocale } from "next-intl/server";

export const dynamic = "force-static";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");

  return (
    <main>
      <h1>{t("title")}</h1>
    </main>
  );
}
