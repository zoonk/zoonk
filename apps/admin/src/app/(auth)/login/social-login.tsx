"use client";

import { authClient } from "@zoonk/auth/client";
import {
  LoginError,
  LoginSocial,
  LoginWithGoogle,
} from "@zoonk/ui/patterns/auth/login";
import { useState } from "react";

type SocialState = "initial" | "loading" | "error";

export function SocialLogin() {
  const [state, setState] = useState<SocialState>("initial");

  const signIn = async () => {
    setState("loading");

    const { error } = await authClient.signIn.social({ provider: "google" });

    if (error) {
      console.error("Social login error:", error);
      setState("error");
    }
  };

  return (
    <LoginSocial>
      <LoginWithGoogle isLoading={state === "loading"} onClick={signIn}>
        Continue with Google
      </LoginWithGoogle>

      <LoginError hasError={state === "error"}>
        Login failed. Try again.
      </LoginError>
    </LoginSocial>
  );
}
