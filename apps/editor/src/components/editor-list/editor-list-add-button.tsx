"use client";

import { Button } from "@zoonk/ui/components/button";
import { PlusIcon } from "lucide-react";
import { useEditorList } from "./editor-list-context";

export function EditorListAddButton({
  children,
  className,
  position,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  position: number;
}) {
  const { pending, handleInsert } = useEditorList();

  return (
    <Button
      className={className}
      data-slot="editor-list-add-button"
      disabled={pending}
      onClick={() => handleInsert(position)}
      size="sm"
      variant="outline"
      {...props}
    >
      <PlusIcon />
      {children}
    </Button>
  );
}
