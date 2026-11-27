"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { ListGroup } from "../../_components/list-group";
import { PageSectionTitle } from "../../_components/page";
import { SheetHeader } from "../../_components/sheet-header";

function usePhrasesTitle(count: number): string {
  const t = useExtracted();

  return t("{count, plural, one {A phrase you can use} other {Phrases you can use}}", { count });
}

export function Phrases({
  conversation,
  titled = true,
}: {
  conversation: LanguageConversationView;
  titled?: boolean;
}) {
  const title = usePhrasesTitle(conversation.hints.length);
  const titleId = useId();

  return (
    <div className="flex flex-col gap-2">
      {titled && <PageSectionTitle id={titleId}>{title}</PageSectionTitle>}
      <ListGroup as="ul" aria-labelledby={titled ? titleId : undefined}>
        {conversation.hints.map((hint, index) => (
          <li
            className="text-reading py-2.5 leading-snug"
            // oxlint-disable-next-line react/no-array-index-key -- Phrases never move, and a generated list may repeat one.
            key={index}
            lang={conversation.targetLanguage}
          >
            <span data-slot="list-row-title">{hint}</span>
          </li>
        ))}
      </ListGroup>
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
  const title = usePhrasesTitle(conversation.hints.length);

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle className="min-w-0 flex-1">{title}</DrawerTitle>
        </SheetHeader>
        <DrawerContent className="pt-1 pb-6">
          <Phrases conversation={conversation} titled={false} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
