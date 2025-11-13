import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function LoginFooter() {
  const t = await getExtracted();

  return (
    <footer className="text-balance text-center text-muted-foreground text-xs *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
      {t.rich(
        "By clicking on Continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.",
        {
          privacy: (children) => <Link href="/privacy">{children}</Link>,
          terms: (children) => <Link href="/terms">{children}</Link>,
        },
      )}
    </footer>
  );
}
