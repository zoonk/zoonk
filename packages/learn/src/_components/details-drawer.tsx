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

type Trigger = "link" | "option" | "secondary" | "small" | "tag";

const TRIGGER: Record<Trigger, React.ReactElement> = {
  link: <Button className="self-start" variant="link" />,
  option: <Button className={TASK_OPTION_CLASS} size="xl" variant="ghost" />,
  secondary: <Button className="shrink-0" size="xl" variant="outline" />,
  small: <Button className="shrink-0" size="sm" variant="outline" />,
  tag: (
    <button
      className="hit-area text-muted-foreground decoration-faint focus-visible:ring-ring/50 relative self-start rounded-md text-xs underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-[3px]"
      type="button"
    />
  ),
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
  trigger?: Trigger;
}) {
  return (
    <Drawer>
      <DrawerTrigger render={TRIGGER[trigger]}>{label}</DrawerTrigger>

      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </SheetHeader>
        <DrawerContent className="pt-2">{children}</DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
