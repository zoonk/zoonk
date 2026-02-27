"use client";

import { logout } from "@zoonk/core/auth/client";
import { Button } from "@zoonk/ui/components/button";
import { LogOutIcon } from "lucide-react";

export function SettingsLogoutButton({ label }: { label: string }) {
  return (
    <Button className="ml-auto" onClick={() => logout()} size="icon" variant="secondary">
      <LogOutIcon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
