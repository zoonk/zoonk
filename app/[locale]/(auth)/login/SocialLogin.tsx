"use client";

import { IconBrandGoogleFilled } from "@tabler/icons-react";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputError } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type SocialState = "initial" | "loadingGoogle" | "error";

export function SocialLogin() {
  const [state, setState] = useState<SocialState>("initial");
  const t = useTranslations("Auth");

  const signIn = async (provider: "google") => {
    setState("loadingGoogle");

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

      {state === "error" && <InputError>{t("errorSigningIn")}</InputError>}
    </div>
  );
}
