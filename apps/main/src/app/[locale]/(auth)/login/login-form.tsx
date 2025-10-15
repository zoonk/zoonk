import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import Form from "next/form";
import { getTranslations } from "next-intl/server";
import { sendVerificationOTPAction } from "./actions";

export default async function LoginForm() {
  const t = await getTranslations("Auth");

  return (
    <Form action={sendVerificationOTPAction} className="flex flex-col gap-6">
      <div className="grid gap-3">
        <Label htmlFor="email">{t("email")}</Label>

        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          spellCheck={false}
          autoCapitalize="none"
          required
        />
      </div>

      <SubmitButton full>{t("submit")}</SubmitButton>
    </Form>
  );
}
