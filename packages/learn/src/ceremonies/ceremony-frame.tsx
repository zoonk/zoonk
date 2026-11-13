"use client";

import { Button } from "@zoonk/ui/components/button";
import { Dialog, DialogPopup, DialogPortal } from "@zoonk/ui/components/dialog";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { EnterButton } from "../_components/enter-button";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { SCREEN_STEADY_MS, useSteady } from "../_utils/use-steady";

/**
 * A full-screen moment's open state. `close` starts its fade; `whenSteady` drops a tap that was
 * meant for the screen before it.
 */
export function useCeremonyFrame(onClosing: () => void) {
  const [open, setOpen] = useState(true);
  const isSteady = useSteady(SCREEN_STEADY_MS);

  function close() {
    setOpen(false);
    onClosing();
  }

  function whenSteady(run: () => void) {
    if (isSteady()) {
      run();
    }
  }

  return { close, open, whenSteady };
}

/** The screen a milestone's ceremony and a certificate's moment share: what was earned, centered, over one bar. */
export function CeremonyFrame({
  bar,
  children,
  onClose,
  onClosed,
  open,
  slot,
}: {
  bar: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  onClosed?: () => void;
  open: boolean;
  slot: string;
}) {
  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          onClosed?.();
        }
      }}
      open={open}
    >
      <DialogPortal>
        <DialogPopup
          className="data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out duration-base fixed inset-0 z-50 flex flex-col overflow-y-auto"
          data-slot={slot}
        >
          <TaskBody className="items-center justify-center gap-8 pt-12 pb-20 text-center">
            {children}
          </TaskBody>

          {bar}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export function CeremonyBar({
  action,
  onConfirm,
  onDecline,
}: {
  action: string;
  onConfirm: () => void;
  onDecline?: () => void;
}) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        {onDecline && (
          <Button className="shrink-0" onClick={onDecline} size="xl" variant="outline">
            {t("Not now")}
          </Button>
        )}

        {/* It takes focus when the moment opens, so Enter is its own. */}
        <EnterButton autoFocus enter="host" onClick={onConfirm}>
          {action}
        </EnterButton>
      </TaskActions>
    </TaskActionBar>
  );
}
