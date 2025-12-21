import { auth } from "@zoonk/auth";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function VerifyToken({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/auth/callback">["searchParams"];
}): Promise<React.ReactNode> {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login" as Parameters<typeof redirect>[0]);
  }

  try {
    await auth.api.verifyOneTimeToken({
      body: { token: String(token) },
    });
  } catch (error) {
    console.error("Failed to verify one-time token:", error);
    redirect("/login" as Parameters<typeof redirect>[0]);
  }

  // Successfully verified, redirect to home
  redirect("/" as Parameters<typeof redirect>[0]);
}

export default async function AuthCallbackPage(
  props: PageProps<"/[locale]/auth/callback">,
) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <VerifyToken searchParams={props.searchParams} />
    </Suspense>
  );
}
