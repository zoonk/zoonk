"use client";

import {
  IconBrandAppleFilled,
  IconBrandGoogleFilled,
} from "@tabler/icons-react";
import { Button } from "@zoonk/ui/components/button";
import { InputError } from "@zoonk/ui/components/input";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

type SocialState = "initial" | "loadingGoogle" | "loadingApple" | "error";

function getLoadingState(provider: "google" | "apple"): SocialState {
  return provider === "google" ? "loadingGoogle" : "loadingApple";
}

export function SocialLogin() {
  const [state, setState] = useState<SocialState>("initial");
  const t = useTranslations("Auth");

  const signIn = async (provider: "google" | "apple") => {
    setState(getLoadingState(provider));

    try {
      await authClient.signIn.social({ provider });
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        type="button"
        className="w-full"
        disabled={state === "loadingGoogle"}
        onClick={() => signIn("google")}
      >
        {state === "loadingGoogle" && <Loader2Icon className="animate-spin" />}
        <IconBrandGoogleFilled aria-hidden="true" />
        {t("continueWithGoogle")}
      </Button>

      <Button
        variant="outline"
        type="button"
        className="w-full"
        disabled={state === "loadingApple"}
        onClick={() => signIn("apple")}
      >
        {state === "loadingApple" && <Loader2Icon className="animate-spin" />}
        <IconBrandAppleFilled aria-hidden="true" />
        {t("continueWithApple")}
      </Button>

      {state === "error" && <InputError>{t("errorSigningIn")}</InputError>}
    </div>
  );
}
