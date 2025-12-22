import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createOneTimeTokenAction } from "./actions";

async function CallbackHandler({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/callback">["searchParams"];
}) {
  const { redirectTo } = await searchParams;

  // Generate OTT and get the redirect URL
  const externalUrl = await createOneTimeTokenAction(String(redirectTo));

  return redirect(externalUrl);
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
