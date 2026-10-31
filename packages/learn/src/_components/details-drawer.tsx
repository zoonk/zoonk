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

const TRIGGER: Record<"option" | "secondary", React.ReactElement> = {
  option: <Button className={TASK_OPTION_CLASS} size="xl" variant="ghost" />,
  secondary: <Button className="shrink-0" size="xl" variant="outline" />,
};

export function DrawerCloseButton() {
  const t = useExtracted();

  return (
    <DrawerClose render={<Button className="-mr-2 shrink-0" size="icon" variant="ghost" />}>
      <XIcon aria-hidden="true" />
      <span className="sr-only">{t("Close")}</span>
    </DrawerClose>
  );
}

export function DetailsDrawer({
  children,
  label,
  title,
  trigger = "option",
}: {
  children: React.ReactNode;
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
