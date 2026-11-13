import { ColumnScreen } from "@/components/public/column-screen";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { UnsubscribeForm } from "./unsubscribe-form";

type Props = PageProps<"/[lang]/study-reminders/unsubscribe">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Email reminders") };
}

async function UnsubscribeContent({ searchParams }: Props) {
  const { token } = await searchParams;
  return <UnsubscribeForm token={typeof token === "string" && token ? token : null} />;
}

export default function UnsubscribePage(props: Props) {
  return (
    <ColumnScreen>
      <Suspense fallback={<Skeleton className="mx-auto h-48 w-full max-w-sm rounded-xl" />}>
        <UnsubscribeContent {...props} />
      </Suspense>
    </ColumnScreen>
  );
}
