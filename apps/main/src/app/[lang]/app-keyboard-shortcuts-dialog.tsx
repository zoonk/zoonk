"use client";

import { ListGroup, ListRow, ListRowContent, ListRowTitle } from "@zoonk/learn/list";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { Kbd, useShortcutCap } from "@zoonk/ui/components/kbd";
import { SHORTCUT_GROUPS, type ShortcutGroup, type ShortcutName } from "@zoonk/ui/lib/shortcuts";
import { useExtracted } from "next-intl";
import { useId } from "react";

const GROUPS = Object.keys(SHORTCUT_GROUPS).filter(
  (group): group is ShortcutGroup => group in SHORTCUT_GROUPS,
);

/** One line per key of the registry, so a key without its line doesn't compile. */
function useShortcutLines(): Record<ShortcutName, string> {
  const t = useExtracted();

  return {
    audio: t("Play or pause the audio"),
    flag: t("Flag a question in a mock exam"),
    leave: t("Close or leave"),
    main: t("Press the main button"),
    next: t("Next"),
    pick: t("Pick an answer"),
    previous: t("Back"),
    save: t("Save a mind map"),
    search: t("Search or ask"),
    shortcuts: t("Show this list"),
    sidebar: t("Show or hide the sidebar"),
    tap: t("Tap the beat"),
  };
}

function useGroupTitles(): Record<ShortcutGroup, string> {
  const t = useExtracted();

  return { anywhere: t("Anywhere"), study: t("While you study") };
}

function ShortcutRow({ line, name }: { line: string; name: ShortcutName }) {
  return (
    <ListRow className="items-center" role="listitem">
      <ListRowContent>
        <ListRowTitle className="font-normal">{line}</ListRowTitle>
      </ListRowContent>
      <Kbd>{useShortcutCap(name)}</Kbd>
    </ListRow>
  );
}

function ShortcutSection({ group }: { group: ShortcutGroup }) {
  const titleId = useId();
  const lines = useShortcutLines();
  const titles = useGroupTitles();

  return (
    <section aria-labelledby={titleId} className="flex flex-col">
      <h3 className="text-sm font-semibold" id={titleId}>
        {titles[group]}
      </h3>

      <ListGroup aria-labelledby={titleId} role="list">
        {SHORTCUT_GROUPS[group].map((name) => (
          <ShortcutRow key={name} line={lines[name]} name={name} />
        ))}
      </ListGroup>
    </section>
  );
}

export default function AppKeyboardShortcutsDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader closeLabel={t("Close")}>
          <DrawerTitle>{t("Keyboard shortcuts")}</DrawerTitle>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-6 pt-2">
          {GROUPS.map((group) => (
            <ShortcutSection group={group} key={group} />
          ))}
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
