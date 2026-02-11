"use client";

import { FeedbackDialogContent } from "@/components/feedback/feedback-dialog";
import { Button } from "@zoonk/ui/components/button";
import { Dialog, DialogTrigger } from "@zoonk/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { EllipsisVerticalIcon, MessageSquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function CatalogActions() {
  const t = useExtracted();

  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon" variant="secondary" />}>
          <EllipsisVerticalIcon />
          <span className="sr-only">{t("More options")}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DialogTrigger nativeButton={false} render={<DropdownMenuItem />}>
            <MessageSquareIcon />
            {t("Send feedback")}
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackDialogContent />
    </Dialog>
  );
}
