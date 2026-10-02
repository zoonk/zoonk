"use client";

import { logout } from "@/lib/logout";
import { Button } from "@zoonk/ui/components/button";
import { LogOutIcon } from "lucide-react";

export function SettingsLogoutButton({ label }: { label: string }) {
  return (
    <Button
      className="ml-auto lg:ml-0"
      onClick={() => void logout()}
      size="icon"
      variant="secondary"
    >
      <LogOutIcon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
