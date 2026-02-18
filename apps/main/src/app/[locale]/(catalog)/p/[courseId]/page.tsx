import { getExtracted } from "next-intl/server";

export default async function PersonalCoursePage() {
  const t = await getExtracted();

  return (
    <main className="container mx-auto flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16">
      <h1 className="text-2xl font-bold">{t("Coming soon")}</h1>
      <p className="text-muted-foreground">{t("Personalized courses are coming soon.")}</p>
    </main>
  );
}
