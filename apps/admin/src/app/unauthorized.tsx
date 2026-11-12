import { LogoutButton } from "@/components/logout";
import { getSession } from "@zoonk/core/users/session";
import { Suspense } from "react";

async function SignedInAs() {
  const session = await getSession();
  return session ? `You're signed in as ${session.user.email}. ` : null;
}

/** Drawn like the sign-in screen it follows: one centered block. */
export default function Unauthorized() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-lg font-semibold">This account can&apos;t open Admin</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          <Suspense fallback={null}>
            <SignedInAs />
          </Suspense>
          Admin is for Zoonk staff.
        </p>
      </div>

      <LogoutButton />
    </main>
  );
}
