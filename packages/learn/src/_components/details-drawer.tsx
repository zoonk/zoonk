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
import { TASK_OPTION_CLASS } from "./task-layout";

/**
 * How the drawer opens: a quiet option on its own row under the task's `TaskActions` row, or a
 * secondary action in it.
 */
const TRIGGER: Record<"option" | "secondary", React.ReactElement> = {
  option: <Button className={TASK_OPTION_CLASS} size="xl" variant="ghost" />,
  secondary: <Button className="shrink-0" size="xl" variant="outline" />,
};

/** A sheet's ✕, at the end of its header beside the title. */
export function DrawerCloseButton() {
  const t = useExtracted();

  return (
    <DrawerClose render={<Button className="-mr-2 shrink-0" size="icon" variant="ghost" />}>
      <XIcon aria-hidden="true" />
      <span className="sr-only">{t("Close")}</span>
    </DrawerClose>
  );
}

/**
 * Detail that can wait (the questions with their answers, every criterion's comment) behind a
 * quiet option under the task's main action, or a secondary action beside it
 * (`trigger="secondary"`), in a sheet from the bottom, so the screen keeps to its one thing.
 */
export function DetailsDrawer({
  children,
  label,
  title,
  trigger = "option",
}: {
  children: React.ReactNode;
  /** The trigger's words, "See the questions". */
  label: string;
  title: string;
  trigger?: "option" | "secondary";
}) {
  return (
    <Drawer>
      <DrawerTrigger render={TRIGGER[trigger]}>{label}</DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>
        <DrawerContent className="pt-2">{children}</DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
