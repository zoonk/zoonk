import { GenerationShortcutLink } from "@/components/generation/generation-shortcut-link";
import { type AppRoute } from "@/i18n/navigation";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { SubscriptionGateTracker } from "./subscription-gate-tracker";

/**
 * Preserves one tracked subscription action while allowing a calling page to
 * provide durable context that is more useful than the generic generation
 * limit message.
 */
export async function UpgradeCTA<Href extends string>({
  backHref,
  backLabel,
  children,
}: {
  backHref: AppRoute<Href>;
  backLabel: string;
  children?: React.ReactNode;
}) {
  const t = await getExtracted();

  return (
    <Empty className="border-0">
      <SubscriptionGateTracker />

      {children ?? (
        <EmptyHeader align="start">
          <EmptyMedia variant="icon">
            <SparklesIcon />
          </EmptyMedia>

          <EmptyTitle>{t("Upgrade to create")}</EmptyTitle>

          <EmptyDescription>
            {t("You’ve reached your free lesson limit. Upgrade for unlimited lessons")}
          </EmptyDescription>
        </EmptyHeader>
      )}

      <EmptyContent align="stretch">
        <GenerationShortcutLink href={backHref} prefetch shortcut="Esc" variant="outline">
          {backLabel}
        </GenerationShortcutLink>

        <GenerationShortcutLink href="/subscription" prefetch shortcut="Enter">
          {t("Upgrade")}
        </GenerationShortcutLink>
      </EmptyContent>
    </Empty>
  );
}
