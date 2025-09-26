import { Suspense } from "react";

export default async function AuthLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <Suspense>{children}</Suspense>
    </main>
  );
}
