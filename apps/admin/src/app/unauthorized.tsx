import { AdminGateScreen } from "@/components/admin-gate-screen";
import { LogoutButton } from "@/components/logout";
import { getSession } from "@zoonk/core/users/session";
import { Suspense } from "react";

async function SignedInAs() {
  const session = await getSession();
  return session ? `You're signed in as ${session.user.email}. ` : null;
}

export default function Unauthorized() {
  return (
    <AdminGateScreen action={<LogoutButton />} title="This account can't open Admin">
      <Suspense fallback={null}>
        <SignedInAs />
      </Suspense>
      Admin is for Zoonk staff.
    </AdminGateScreen>
  );
}
