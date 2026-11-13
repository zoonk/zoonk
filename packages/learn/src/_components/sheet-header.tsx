"use client";

import { DrawerHeader } from "@zoonk/ui/components/drawer";
import { useExtracted } from "next-intl";

/** A sheet's header in the app's words: its title, the line under it, and the ✕. */
export function SheetHeader(props: Omit<React.ComponentProps<typeof DrawerHeader>, "closeLabel">) {
  const t = useExtracted();
  return <DrawerHeader closeLabel={t("Close")} {...props} />;
}
