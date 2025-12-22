import { auth } from "@zoonk/auth";
import { safeAsync } from "@zoonk/utils/error";
import { redirect } from "next/navigation";

export default async function AuthCallbackPage({
  searchParams,
}: PageProps<"/auth/callback">) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login");
  }

  const { error } = await safeAsync(async () => {
    await auth.api.verifyOneTimeToken({
      body: { token: String(token) },
    });
  });

  if (error) {
    console.error("Failed to verify one-time token:", error);
    redirect("/login");
  }

  redirect("/");
}
