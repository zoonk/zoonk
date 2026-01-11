import { getExtracted } from "next-intl/server";

export async function BeltExplanation() {
  const t = await getExtracted();

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-sm">{t("About Belt Levels")}</h3>

      <p className="text-muted-foreground text-sm">
        {t(
          "Brain Power (BP) represents your knowledge growth. Unlike energy, BP never decreases - it only grows as you learn more.",
        )}
      </p>

      <p className="text-muted-foreground text-sm">
        {t(
          "Every time you complete an activity, you earn Brain Power. As you accumulate BP, you progress through 10 belt colors, each with 10 levels.",
        )}
      </p>

      <p className="text-muted-foreground text-sm">
        {t(
          "Belt colors in order: White, Yellow, Orange, Green, Blue, Purple, Brown, Red, Gray, and Black. Keep learning to reach the highest level!",
        )}
      </p>
    </section>
  );
}
