import { AdminGateScreen } from "@/components/admin-gate-screen";
import { LogoutButton } from "@/components/logout";
import { LINK_CLASS } from "@/lib/link-class";
import { getSession } from "@zoonk/core/users/session";
import { MAIN_URL } from "@zoonk/utils/url";
import { Suspense } from "react";

async function LoggedInAs() {
  const session = await getSession();

  return session ? (
    <>
      You&apos;re logged in as <span className="block wrap-anywhere">{session.user.email}.</span>
    </>
  ) : null;
}

export default function Unauthorized() {
  return (
    <AdminGateScreen
      action={
        <div className="flex flex-col items-center gap-4">
          <LogoutButton />
          <a className={`${LINK_CLASS} text-sm`} href={MAIN_URL}>
            Go to Zoonk
          </a>
        </div>
      }
      title="This account can't open Admin"
    >
      <Suspense fallback={null}>
        <LoggedInAs />
      </Suspense>
      Admin is for Zoonk staff.
    </AdminGateScreen>
  );
}
