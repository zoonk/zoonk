import { Logo } from "@/components/logo";
import { SocialLinks } from "@/components/social-links";
import { Analytics } from "@vercel/analytics/next";
import { buttonVariants } from "@zoonk/ui/components/button";
import { BLOG_URL } from "@zoonk/utils/url";
import { type Metadata } from "next";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  alternates: { canonical: "./" },
  description: "What we're building at Zoonk, and why: a study plan for each day, from any goal.",
  metadataBase: new URL(BLOG_URL),
  title: { default: "Zoonk Blog", template: "%s | Zoonk Blog" },
};

const TRY_ZOONK = { href: "https://www.zoonk.com", label: "Try Zoonk" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6">
          <header className="mb-10 flex items-center justify-between">
            <Logo />

            <a href={TRY_ZOONK.href} className={buttonVariants({ size: "bar" })}>
              {TRY_ZOONK.label}
            </a>
          </header>

          <main className="grow">{children}</main>

          <footer className="border-border text-muted-foreground mt-16 border-t pt-6">
            <SocialLinks />
          </footer>
        </div>

        <Analytics debug={false} />
      </body>
    </html>
  );
}
