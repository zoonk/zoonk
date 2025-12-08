"use client";

import { authClient } from "@zoonk/auth/client";
import {
  LoginError,
  LoginSocial,
  LoginWithApple,
  LoginWithGoogle,
} from "@zoonk/ui/patterns/auth/login";
import { useExtracted } from "next-intl";
import { useState } from "react";

type SocialState = "initial" | "loadingGoogle" | "loadingApple" | "error";

function getLoadingState(provider: "google" | "apple"): SocialState {
  return provider === "google" ? "loadingGoogle" : "loadingApple";
}

export function SocialLogin() {
  const [state, setState] = useState<SocialState>("initial");
  const t = useExtracted();

  const signIn = async (provider: "google" | "apple") => {
    setState(getLoadingState(provider));

    const { error } = await authClient.signIn.social({ provider });

    if (error) {
      console.error("Social login error:", error);
      setState("error");
    }
  };

  return (
    <LoginSocial>
      <LoginWithGoogle
        isLoading={state === "loadingGoogle"}
        onClick={() => signIn("google")}
      >
        {t("Continue with Google")}
      </LoginWithGoogle>

      <LoginWithApple
        isLoading={state === "loadingApple"}
        onClick={() => signIn("apple")}
      >
        {t("Continue with Apple")}
      </LoginWithApple>

      {state === "error" && (
        <LoginError>
          {t(
            "There was an error signing you in. Please try again or contact hello@zoonk.com",
          )}
        </LoginError>
      )}
    </LoginSocial>
  );
}
