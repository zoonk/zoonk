import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import Form from "next/form";
import { getExtracted } from "next-intl/server";
import { sendVerificationOTPAction } from "./actions";

export default async function LoginForm() {
  const t = await getExtracted();

  return (
    <Form action={sendVerificationOTPAction} className="flex flex-col gap-6">
      <div className="grid gap-3">
        <Label htmlFor="email">{t("Email")}</Label>

        <Input
          autoCapitalize="none"
          autoComplete="email"
          id="email"
          name="email"
          placeholder={t("myemail@gmail.com")}
          required
          spellCheck={false}
          type="email"
        />
      </div>

      <SubmitButton full>{t("Continue")}</SubmitButton>
    </Form>
  );
}
