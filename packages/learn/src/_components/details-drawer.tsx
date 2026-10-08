"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * Detail that can wait (the questions with their answers, every criterion's comment) behind a
 * quiet text link, in a sheet from the bottom, so the screen keeps to its one thing.
 */
export function DetailsDrawer({
  children,
  label,
  title,
}: {
  children: React.ReactNode;
  /** The link's words, "See the questions". */
  label: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <Button
            className="text-muted-foreground hover:text-foreground mx-auto underline-offset-4 hover:bg-transparent hover:underline dark:hover:bg-transparent"
            size="lg"
            variant="ghost"
          />
        }
      >
        {label}
      </DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
          <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </DrawerClose>
        </DrawerHeader>
        <DrawerContent className="pt-2">{children}</DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
