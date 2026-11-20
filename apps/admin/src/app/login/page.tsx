import { FullPageLoading } from "@zoonk/ui/components/loading";
import { type Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginScreen />
    </Suspense>
  );
}
