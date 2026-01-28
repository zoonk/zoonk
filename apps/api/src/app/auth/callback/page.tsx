import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createOneTimeTokenAction } from "./actions";

type CallbackPageProps = {
  searchParams: Promise<{ redirectTo?: string }>;
};

async function CallbackHandler({ searchParams }: CallbackPageProps) {
  const { redirectTo } = await searchParams;
  const result = await createOneTimeTokenAction(String(redirectTo));

  if (!result.success) {
    return redirect("/auth/untrusted-origin");
  }

  return redirect(result.url);
}

export default async function CallbackPage(props: CallbackPageProps) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler searchParams={props.searchParams} />
    </Suspense>
  );
}
