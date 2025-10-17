import { Suspense } from "react";

export default function Layout({ children }: LayoutProps<"/tasks/[taskId]">) {
  return <Suspense>{children}</Suspense>;
}
