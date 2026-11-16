import { AdminGateScreen } from "@/components/admin-gate-screen";
import { LogoutButton } from "@/components/logout";
import { getSession } from "@zoonk/core/users/session";
import { Suspense } from "react";

async function LoggedInAs() {
  const session = await getSession();

  return session ? (
    <>
      You&apos;re logged in as <span className="whitespace-nowrap">{session.user.email}</span>.{" "}
    </>
  ) : null;
}

export default function Unauthorized() {
  return (
    <AdminGateScreen action={<LogoutButton />} title="This account can't open Admin">
      <Suspense fallback={null}>
        <LoggedInAs />
      </Suspense>
      Admin is for Zoonk staff.
    </AdminGateScreen>
  );
}
