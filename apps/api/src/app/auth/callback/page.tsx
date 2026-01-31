import { externalRedirect } from "@zoonk/next/navigation/external-redirect";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createOneTimeTokenAction } from "./actions";

async function CallbackHandler({
  searchParams,
}: {
  searchParams: PageProps<"/auth/callback">["searchParams"];
}) {
  const { redirectTo } = await searchParams;
  const result = await createOneTimeTokenAction(String(redirectTo));

  if (!result.success) {
    return redirect("/auth/untrusted-origin");
  }

  return externalRedirect(result.url);
}

export default async function CallbackPage(props: PageProps<"/auth/callback">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler searchParams={props.searchParams} />
    </Suspense>
  );
}
