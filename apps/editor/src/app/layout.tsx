import { Suspense } from "react";

// without using Suspense on a root layout, cacheComponents breaks when using parallel routes
export default function RootLayout({ children }: LayoutProps<"/">) {
  return <Suspense>{children}</Suspense>;
}
