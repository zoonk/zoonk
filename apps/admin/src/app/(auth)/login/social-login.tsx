"use client";

import { IconBrandGoogleFilled } from "@tabler/icons-react";
import { authClient } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";
import { InputError } from "@zoonk/ui/components/input";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import {
  authCallbackUrl,
  authErrorCallbackUrl,
  authNewUserCallbackUrl,
} from "@/lib";

type SocialState = "initial" | "loading" | "error";

export function SocialLogin() {
  const [state, setState] = useState<SocialState>("initial");

  const signIn = async () => {
    setState("loading");

    const { error } = await authClient.signIn.social({
      callbackURL: authCallbackUrl,
      errorCallbackURL: authErrorCallbackUrl,
      newUserCallbackURL: authNewUserCallbackUrl,
      provider: "google",
    });

    if (error) {
      console.error("Social login error:", error);
      setState("error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        disabled={state === "loading"}
        onClick={signIn}
        type="button"
        variant="outline"
      >
        {state === "loading" && <Loader2Icon className="animate-spin" />}
        <IconBrandGoogleFilled aria-hidden="true" />
        Continue with Google
      </Button>

      {state === "error" && <InputError>Login failed. Try again.</InputError>}
    </div>
  );
}
