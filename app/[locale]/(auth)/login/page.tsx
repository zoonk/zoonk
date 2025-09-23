import Form from "next/form";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SubmitButton from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/user";
import { sendVerificationOTPAction } from "./actions";
import { SocialLogin } from "./SocialLogin";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  const t = await getTranslations("Auth");
  const session = await getSession();

  if (session) {
    return redirect(`/${locale}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-center text-sm">{t("subtitle")}</p>
      </div>

      <SocialLogin />

      <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
        <span className="bg-background text-muted-foreground relative z-10 px-2">
          {t("socialOr")}
        </span>
      </div>

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

        <SubmitButton>{t("submit")}</SubmitButton>
      </Form>

      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        {t.rich("terms", {
          terms: (children) => <Link href="/terms">{children}</Link>,
          privacy: (children) => <Link href="/privacy">{children}</Link>,
        })}
      </div>
    </div>
  );
}
