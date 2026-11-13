"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { SheetHeader } from "./sheet-header";
import { TASK_OPTION_CLASS } from "./task-layout";

const TRIGGER: Record<"link" | "option" | "secondary", React.ReactElement> = {
  link: <Button className="self-start" variant="link" />,
  option: <Button className={TASK_OPTION_CLASS} size="xl" variant="ghost" />,
  secondary: <Button className="shrink-0" size="xl" variant="outline" />,
};

export function DetailsDrawer({
  children,
  label,
  title,
  trigger = "option",
}: {
  children: React.ReactNode;
  label: string;
  title: string;
  trigger?: "link" | "option" | "secondary";
}) {
  return (
    <Drawer>
      <DrawerTrigger render={TRIGGER[trigger]}>{label}</DrawerTrigger>

      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
        </SheetHeader>
        <DrawerContent className="pt-2">{children}</DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
