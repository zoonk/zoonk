"use client";

import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { Button } from "@zoonk/ui/components/button";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { type KeepPlusResult, keepPlusAction } from "./keep-plus-action";

export function KeepPlusButton() {
  const t = useExtracted();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const keep = () => {
    startTransition(async () => {
      const outcome = await noteAppWrite(keepPlusAction()).catch((): KeepPlusResult => "failed");

      if (outcome === "failed") {
        showErrorToast(t("We couldn't keep Plus. Try again or email hello@zoonk.com."));
      }

      if (outcome === "unavailable") {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{t("Keep Plus, and it renews as before.")}</p>

      <form action={() => keep()} className="contents">
        <Button
          busy={pending}
          className="w-max"
          icon={<Undo2Icon aria-hidden="true" />}
          size="sm"
          type="submit"
          variant="outline"
        >
          {t("Keep Plus")}
        </Button>
      </form>
    </div>
  );
}
