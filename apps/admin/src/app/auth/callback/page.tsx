import { auth } from "@zoonk/auth";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function VerifyToken({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<React.ReactNode> {
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

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <VerifyToken searchParams={searchParams} />
    </Suspense>
  );
}
