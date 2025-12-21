import { auth } from "@zoonk/auth";
import { redirect } from "next/navigation";

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login");
  }

  try {
    await auth.api.verifyOneTimeToken({
      body: { token: String(token) },
    });
  } catch (error) {
    console.error("Failed to verify one-time token:", error);
    redirect("/login");
  }

  // Successfully verified, redirect to home
  redirect("/");
}
