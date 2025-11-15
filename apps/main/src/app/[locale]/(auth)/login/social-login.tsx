"use client";

import {
  IconBrandAppleFilled,
  IconBrandGoogleFilled,
} from "@tabler/icons-react";
import { authClient } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";
import { InputError } from "@zoonk/ui/components/input";
import { Loader2Icon } from "lucide-react";
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

    try {
      await authClient.signIn.social({ provider });
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        disabled={state === "loadingGoogle"}
        onClick={() => signIn("google")}
        type="button"
        variant="outline"
      >
        {state === "loadingGoogle" && <Loader2Icon className="animate-spin" />}
        <IconBrandGoogleFilled aria-hidden="true" />
        {t("Continue with Google")}
      </Button>

      <Button
        className="w-full"
        disabled={state === "loadingApple"}
        onClick={() => signIn("apple")}
        type="button"
        variant="outline"
      >
        {state === "loadingApple" && <Loader2Icon className="animate-spin" />}
        <IconBrandAppleFilled aria-hidden="true" />
        {t("Continue with Apple")}
      </Button>

      {state === "error" && (
        <InputError>
          {t(
            "There was an error signing you in. Please try again or contact hello@zoonk.com",
          )}
        </InputError>
      )}
    </div>
  );
}
