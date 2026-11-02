"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { Button } from "@zoonk/ui/components/button";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type KeepPlusResult, keepPlusAction } from "./keep-plus-action";

export function KeepPlusButton() {
  const t = useExtracted();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<KeepPlusResult | null>(null);

  const keep = () => {
    startTransition(async () => {
      const outcome = await noteAppWrite(keepPlusAction()).catch((): KeepPlusResult => "failed");
      setResult(outcome);

      if (outcome === "unavailable") {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {t("Changed your mind? Keep Plus, and it renews as before.")}
      </p>

      <Button
        aria-busy={pending}
        className="w-max"
        disabled={pending}
        onClick={keep}
        size="sm"
        variant="outline"
      >
        {pending && <Loader2Icon aria-hidden="true" className="animate-spin" />}
        {t("Keep Plus")}
      </Button>

      {result === "failed" && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't keep Plus. Try again or email hello@zoonk.com.")}
        </p>
      )}
    </div>
  );
}
