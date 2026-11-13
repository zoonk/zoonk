"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { LIST_GROUP_CLASS } from "../../_components/list-group";
import { PageSectionTitle } from "../../_components/page";
import { SheetHeader } from "../../_components/sheet-header";

export function Phrases({
  conversation,
  titled = true,
}: {
  conversation: LanguageConversationView;
  titled?: boolean;
}) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <div className="flex flex-col gap-2">
      {titled && <PageSectionTitle id={titleId}>{t("Phrases you can use")}</PageSectionTitle>}
      <ul aria-labelledby={titled ? titleId : undefined} className={LIST_GROUP_CLASS}>
        {conversation.hints.map((hint, index) => (
          <li
            className="text-reading py-2.5 leading-snug text-pretty"
            // oxlint-disable-next-line react/no-array-index-key -- Phrases never move, and a generated list may repeat one.
            key={index}
            lang={conversation.targetLanguage}
          >
            {hint}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** On a phone the phrases open over the call, so the transcript it follows doesn't grow under them. */
export function PhrasesSheet({
  conversation,
  onOpenChange,
  open,
}: {
  conversation: LanguageConversationView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle className="min-w-0 flex-1">{t("Phrases you can use")}</DrawerTitle>
        </SheetHeader>
        <DrawerContent className="pt-1 pb-6">
          <Phrases conversation={conversation} titled={false} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
