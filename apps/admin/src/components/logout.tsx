"use client";

import { logout } from "@zoonk/auth/client";
import { EnterButton } from "@zoonk/ui/components/enter-button";

export function LogoutButton() {
  return (
    <EnterButton onClick={() => logout()} size="lg" type="button">
      Use another account
    </EnterButton>
  );
}
