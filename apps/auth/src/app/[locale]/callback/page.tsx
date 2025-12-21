import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createOneTimeTokenAction } from "./actions";

async function CallbackHandler({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/callback">["searchParams"];
}) {
  const session = await getSession();
  const { redirectTo } = await searchParams;

  if (!session) {
    // Not logged in, redirect to login
    const loginUrl = redirectTo
      ? `/login?redirectTo=${encodeURIComponent(String(redirectTo))}`
      : "/login";
    redirect(loginUrl as Parameters<typeof redirect>[0]);
  }

  if (!redirectTo) {
    // No redirect URL, show a success message
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="font-bold text-xl">{"You're signed in!"}</h1>
        <p className="text-muted-foreground">
          {"You can close this window and return to your app."}
        </p>
      </div>
    );
  }

  // Generate OTT and redirect
  await createOneTimeTokenAction(String(redirectTo));

  // This won't be reached due to redirect, but TypeScript needs it
  return null;
}

export default async function CallbackPage(
  props: PageProps<"/[locale]/callback">,
) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler searchParams={props.searchParams} />
    </Suspense>
  );
}
