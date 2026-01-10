import { ZapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function EnergyExplanation() {
  const t = await getExtracted();

  return (
    <section className="flex flex-col gap-1 border-t pt-6">
      <div className="flex items-center gap-1.5 text-energy">
        <ZapIcon aria-hidden className="size-4" />
        <span className="font-medium text-sm">{t("About Energy Level")}</span>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        {t(
          "Energy reflects your learning consistency. It increases with correct answers (+0.1%), decreases with wrong answers (-0.03%), and drops 1% for each inactive day.",
        )}
      </p>
    </section>
  );
}
