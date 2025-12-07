"use client";

import { authClient } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";

export default function Unauthorized() {
  const { push } = useRouter();
  const t = useExtracted();

  const logout = async () => {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => push("/login") },
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 bg-background p-6 antialiased md:p-10">
      <header className="flex flex-col items-center gap-2">
        <h1 className="font-semibold">{t("401 - Unauthorized")}</h1>

        <p className="text-balance text-center">
          {t(
            "You can’t edit courses for this organization. Log in with another account or switch to a different organization.",
          )}
        </p>
      </header>

      <Button onClick={logout}>{t("Logout")}</Button>
    </main>
  );
}
