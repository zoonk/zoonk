"use client";

import { logout } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";

export function LogoutButton() {
  return (
    <Button onClick={() => logout()} type="button">
      Logout
    </Button>
  );
}
