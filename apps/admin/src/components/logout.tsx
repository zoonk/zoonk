"use client";

import { logout } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";

export function LogoutButton() {
  return (
    <Button onClick={() => logout()} size="lg" type="button">
      Use another account
    </Button>
  );
}
