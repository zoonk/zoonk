"use client";

import { type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { cn } from "@zoonk/ui/lib/utils";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { useId, useRef, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { CLEAR_OF_PINNED_ACTIONS_CLASS } from "../_components/pinned-actions";
import { SheetHeader } from "../_components/sheet-header";
import { SIDE_DETAIL_PANE_CLASS } from "../_components/side-detail";
import { type BuddyGlassesOption, BuddyGlassesPicker } from "../buddies/buddy-glasses-picker";
import { BUDDY_GLASSES } from "../buddies/buddy-labels";
import { type BuddyChoice, type BuddyLook, BuddyPicker } from "../buddies/buddy-picker";
import { useBuddyName, useDefaultBuddyName } from "../buddies/use-buddy-name";

export type AppearanceBuddy = { glasses: BuddyGlasses; kind: BuddyKind; name: string | null };

function toGlassesOptions(available: BuddyGlasses[]): BuddyGlassesOption[] {
  return BUDDY_GLASSES.map((glasses) => ({ earned: available.includes(glasses), glasses }));
}

type SavedBuddy = {
  initial: BuddyChoice;
  /** Whether the learner chose this buddy; one they were given can be saved as it is. */
  picked: boolean;
};

type BuddyLooks = { glasses?: BuddyGlassesOption[]; look: BuddyLook };

function useBuddyDraft({ initial, picked }: SavedBuddy) {
  const defaultName = useDefaultBuddyName();

  const fromSaved = (saved: BuddyChoice) => ({
    ...saved,
    name: saved.name || defaultName(saved.kind),
  });

  const [choice, setChoice] = useState(() => fromSaved(initial));

  const trimmedName = choice.name.trim();
  const name = initial.name || trimmedName !== defaultName(choice.kind) ? trimmedName : "";

  const changed =
    !picked ||
    choice.kind !== initial.kind ||
    choice.glasses !== initial.glasses ||
    name !== initial.name;

  return {
    changed,
    choice,
    /** Starts over from `saved`: the buddy as it is, or as a save just made it. */
    reset: (saved: BuddyChoice) => setChoice(fromSaved(saved)),
    setChoice,
    showDefaultName: !initial.name,
    value: { ...choice, name },
  };
}

type BuddyDraft = ReturnType<typeof useBuddyDraft>;

function BuddyFields({ draft, glasses, look }: BuddyLooks & { draft: BuddyDraft }) {
  const t = useExtracted();

  return (
    <>
      <BuddyPicker
        choice={draft.choice}
        look={look}
        onChange={draft.setChoice}
        showDefaultName={draft.showDefaultName}
      />

      {glasses && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("Glasses")}</p>
          <BuddyGlassesPicker
            kind={draft.choice.kind}
            look={look}
            onChange={(next) => draft.setChoice({ ...draft.choice, glasses: next })}
            options={glasses}
            value={draft.choice.glasses}
          />
        </div>
      )}
    </>
  );
}

/** The editor's fields as a form, so Enter in the name saves as its Save does. */
function BuddyForm({
  draft,
  id,
  onSave,
  ...fields
}: BuddyLooks & { draft: BuddyDraft; id: string; onSave: (choice: BuddyChoice) => void }) {
  return (
    <form
      className="flex flex-col gap-5"
      id={id}
      onSubmit={(event) => {
        event.preventDefault();

        if (draft.changed) {
          onSave(draft.value);
        }
      }}
    >
      <BuddyFields draft={draft} {...fields} />
    </form>
  );
}

type BuddyEditorProps = BuddyLooks & { onClose: () => void; onSave: (choice: BuddyChoice) => void };

function BuddyDialog({
  draft,
  glasses,
  look,
  onClose,
  onSave,
}: BuddyEditorProps & { draft: BuddyDraft }) {
  const t = useExtracted();
  const formId = useId();

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle>{t("Your buddy")}</DrawerTitle>
        </SheetHeader>

        <DrawerContent className="pt-2">
          <BuddyForm draft={draft} glasses={glasses} id={formId} look={look} onSave={onSave} />
        </DrawerContent>

        <DrawerFooter>
          <EnterButton disabled={!draft.changed} form={formId} size="lg" type="submit">
            {t("Save")}
          </EnterButton>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}

/** The editor as a dialog that starts from the saved buddy each time it opens. */
export function BuddyEditor({ initial, picked, ...props }: BuddyEditorProps & SavedBuddy) {
  const draft = useBuddyDraft({ initial, picked });
  return <BuddyDialog draft={draft} {...props} />;
}

/**
 * The buddy's place beside Preferences' rows where a detail has a pane (`LIST_DETAIL_GRID_CLASS`):
 * always open, so looking at the buddies needs no step, its Save in the page's bar as About you's is.
 */
function BuddyPane({
  draft,
  glasses,
  look,
  onSave,
}: BuddyLooks & { draft: BuddyDraft; onSave: (choice: BuddyChoice) => void }) {
  const t = useExtracted();
  const titleId = useId();
  const formId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "hidden xl:in-data-signed-in:col-start-2 xl:in-data-signed-in:row-start-1",
        SIDE_DETAIL_PANE_CLASS,
      )}
      data-slot="settings-detail"
    >
      <Page>
        <PageSection className={cn("@container/buddy-pane", CLEAR_OF_PINNED_ACTIONS_CLASS)}>
          <PageSectionHeader>
            <PageSectionTitle id={titleId}>{t("Your buddy")}</PageSectionTitle>
          </PageSectionHeader>

          <BuddyForm draft={draft} glasses={glasses} id={formId} look={look} onSave={onSave} />
        </PageSection>

        <BottomBar>
          <BottomBarActions>
            <EnterButton disabled={!draft.changed} form={formId} type="submit">
              {t("Save")}
            </EnterButton>
          </BottomBarActions>
        </BottomBar>
      </Page>
    </section>
  );
}

function CurrentBuddy({ look, buddy }: { look: BuddyLook; buddy: AppearanceBuddy }) {
  const name = useBuddyName(buddy);

  return (
    <>
      <ListRowLeading>
        <Buddy
          beltColor={look.beltColor}
          className="size-8"
          energy={look.energy}
          glasses={buddy.glasses}
          kind={buddy.kind}
          studiedToday={look.studiedToday}
          view="face"
        />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className="truncate">{name}</ListRowTitle>
      </ListRowContent>
    </>
  );
}

function toAppearanceBuddy(choice: BuddyChoice): AppearanceBuddy {
  return { glasses: choice.glasses, kind: choice.kind, name: choice.name.trim() || null };
}

/**
 * Its row opens the editor over the page. Where a detail has a pane the editor is that pane, and
 * the row steps out: the pane already shows the buddy.
 */
export function BuddySettings({
  availableGlasses,
  look,
  onSave,
  buddy,
}: {
  availableGlasses: BuddyGlasses[];
  look: BuddyLook;
  /** `onSaved` runs once the save went through, for a save that leaves its form on the screen. */
  onSave: (buddy: AppearanceBuddy, onSaved?: () => void) => void;
  buddy: ResolvedBuddy;
}) {
  const t = useExtracted();
  const [isEditing, setIsEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const saved = { glasses: buddy.glasses, kind: buddy.kind, name: buddy.name ?? "" };
  const glasses = toGlassesOptions(availableGlasses);

  // One draft for the dialog and the pane, so a resize between them keeps the edit and the save.
  const draft = useBuddyDraft({ initial: saved, picked: buddy.picked });

  const save = (choice: BuddyChoice, onSaved?: () => void) => {
    draft.reset(choice);
    onSave(toAppearanceBuddy(choice), onSaved);
  };

  const close = () => {
    setIsEditing(false);
    trigger.current?.focus();
  };

  return (
    <>
      <PageSection className="xl:in-data-signed-in:hidden">
        <PageSectionHeader>
          <PageSectionTitle>{t("Your buddy")}</PageSectionTitle>
        </PageSectionHeader>

        <ListGroup>
          <ListRow className="items-center">
            <CurrentBuddy look={look} buddy={buddy} />

            <Button
              aria-haspopup="dialog"
              className="shrink-0"
              onClick={() => setIsEditing(true)}
              ref={trigger}
              size="lg"
              variant="outline"
            >
              {buddy.picked ? t("Change") : t("Choose your buddy")}
            </Button>
          </ListRow>
        </ListGroup>
      </PageSection>

      {isEditing && (
        <BuddyDialog
          draft={draft}
          glasses={glasses}
          look={look}
          onClose={() => {
            draft.reset(saved);
            close();
          }}
          onSave={(choice) => {
            close();
            save(choice);
          }}
        />
      )}

      <BuddyPane
        draft={draft}
        glasses={glasses}
        look={look}
        onSave={(choice) => save(choice, () => showSuccessToast(t("Saved.")))}
      />
    </>
  );
}
