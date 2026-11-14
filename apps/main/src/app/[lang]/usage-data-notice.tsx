"use client";

import { Link } from "@/i18n/navigation";
import { hasSessionHint } from "@/lib/learner/session-hint";
import { chooseUsageDataSharing } from "@/lib/usage-data/usage-data-choice";
import { USAGE_NOTICE_ATTRIBUTE } from "@/lib/usage-data/usage-notice-script";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

function PrivacyLink(chunks: React.ReactNode) {
  return (
    <Link className="hover:text-foreground underline underline-offset-3" href="/privacy">
      {chunks}
    </Link>
  );
}

function choose(share: boolean) {
  document.documentElement.removeAttribute(USAGE_NOTICE_ATTRIBUTE);
  void chooseUsageDataSharing({ saveToAccount: hasSessionHint(), share });
}

/**
 * Above the page's own bars on public and app pages, never on a task screen, and shown by `<html>`'s
 * mark from the first paint, so it never moves the page or covers it. `className` lines its row up
 * with the page's. Declining is one tap, like accepting.
 */
export function UsageDataNotice({ className }: { className: string }) {
  const t = useExtracted();

  return (
    <section
      aria-label={t("Usage data")}
      className="usage-notice:block bg-background hidden border-b"
    >
      <div
        className={cn(
          className,
          "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        )}
      >
        <p className="text-muted-foreground text-sm text-pretty">
          {t.rich(
            "Can we use cookies to see how you use Zoonk, so we can improve it? <link>Privacy</link>",
            { link: PrivacyLink },
          )}
        </p>

        <div className="flex shrink-0 gap-2">
          <Button className="flex-1 sm:flex-none" onClick={() => choose(false)} variant="outline">
            {t("Decline")}
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => choose(true)} variant="outline">
            {t("Accept")}
          </Button>
        </div>
      </div>
    </section>
  );
}
