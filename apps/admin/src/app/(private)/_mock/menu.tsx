"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { Button } from "@zoonk/ui/components/button";
import { DetailMenu } from "@zoonk/ui/components/detail";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { useState } from "react";

export type MockAction = {
  confirm?: { confirmLabel: string; description: string; destructive?: boolean; title: string };
  destructive?: boolean;
  icon?: React.ReactNode;
  label: string;
};

async function nothing() {
  // A picture: confirming does nothing.
}

/** The "…" menu of a mocked record, with the confirmation each action opens. */
export function MockMenu({ actions, label }: { actions: MockAction[]; label: string }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <DetailMenu label={label}>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={() => setOpen(action.label)}
            variant={action.destructive ? "destructive" : undefined}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DetailMenu>

      {actions.map((action) =>
        action.confirm ? (
          <AdminConfirmDialog
            action={nothing}
            confirmLabel={action.confirm.confirmLabel}
            description={action.confirm.description}
            destructive={action.confirm.destructive}
            key={action.label}
            onOpenChange={(next) => setOpen(next ? action.label : null)}
            open={open === action.label}
            title={action.confirm.title}
          />
        ) : null,
      )}
    </>
  );
}

/** A header button that opens a mocked dialog: a form or a confirmation with fields. */
export function MockConfirmButton({
  children,
  confirmLabel,
  description,
  destructive,
  label,
  title,
}: {
  children?: React.ReactNode;
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  label: string;
  title: string;
}) {
  return (
    <AdminConfirmDialog
      action={nothing}
      confirmLabel={confirmLabel}
      description={description}
      destructive={destructive}
      title={title}
      trigger={
        <Button size="lg" variant="outline">
          {label}
        </Button>
      }
    >
      {children}
    </AdminConfirmDialog>
  );
}
