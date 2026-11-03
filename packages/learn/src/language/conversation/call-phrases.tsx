"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { DrawerCloseButton } from "../../_components/details-drawer";
import { LIST_GROUP_CLASS } from "../../_components/list-group";
import { PageSectionTitle } from "../../_components/page";

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
        {conversation.hints.map((hint) => (
          <li
            className="py-2.5 text-[0.9375rem] leading-snug text-pretty"
            key={hint}
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
        <DrawerHeader className="flex-row items-center gap-3">
          <DrawerTitle className="min-w-0 flex-1 text-xl font-semibold">
            {t("Phrases you can use")}
          </DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>
        <DrawerContent className="pt-1 pb-6">
          <Phrases conversation={conversation} titled={false} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
