"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type PlusApprovalRequestStatus, requestPlusApprovalAction } from "./plus-approval-action";
import { PLUS_CTA_CLASS } from "./plus-cta";

/**
 * Learners under 18 need a guardian's approval before checkout, so instead of a Subscribe button
 * that can only fail, they ask their guardian by email, or invite one first.
 */
export function GuardianApprovalRequest() {
  const t = useExtracted();
  const [status, setStatus] = useState<PlusApprovalRequestStatus | "error" | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const ask = () =>
    startTransition(async () => {
      const result = await requestPlusApprovalAction().catch(() => "error" as const);

      // Their guardian approved in the meantime: the page shows Subscribe once it reloads.
      if (result === "notNeeded") {
        router.refresh();
        return;
      }

      setStatus(result);
    });

  if (status === "noGuardian") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("Invite a parent or guardian first. Once they accept, you can ask them here.")}
        </p>

        <Link
          className={cn(buttonVariants({ size: "lg" }), PLUS_CTA_CLASS)}
          href="/settings/guardian"
        >
          {t("Invite a guardian")}
        </Link>
      </div>
    );
  }

  if (status === "requested") {
    return (
      <p className="text-sm leading-relaxed" role="status">
        {t("We emailed your guardian. Once they approve, come back here to subscribe.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("You're under 18, so a guardian approves Plus before you subscribe.")}
      </p>

      <Button
        aria-busy={isPending}
        className={PLUS_CTA_CLASS}
        disabled={isPending}
        onClick={ask}
        size="lg"
        type="button"
      >
        {isPending && <Loader2Icon aria-hidden="true" className="animate-spin" />}
        {t("Ask my guardian")}
      </Button>

      {(status === "error" || status === "unauthorized" || status === "accountRequired") && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't send that. Try again in a moment.")}
        </p>
      )}
    </div>
  );
}
