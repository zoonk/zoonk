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

export async function UpgradeCTA<Href extends string>({
  backHref,
  backLabel,
  description,
  title,
}: {
  backHref: AppRoute<Href>;
  backLabel: string;
  description?: string;
  title?: string;
}) {
  const t = await getExtracted();

  return (
    <Empty className="border-0">
      <SubscriptionGateTracker />

      <EmptyHeader align="start">
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{title ?? t("Upgrade to create")}</EmptyTitle>

        <EmptyDescription>
          {description ?? t("You’ve reached your free lesson limit. Upgrade for unlimited lessons")}
        </EmptyDescription>
      </EmptyHeader>

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
