import { Logo } from "@/components/logo";
import { SocialLinks } from "@/components/social-links";
import { type Metadata } from "next";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  description: "Thoughts on education, technology, and open source.",
  title: {
    default: "Zoonk Blog",
    template: "%s | Zoonk Blog",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
          <header className="mb-10 flex items-center justify-between">
            <Logo />

            <a
              href="https://zoonk.com"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              zoonk.com
            </a>
          </header>

          <main className="grow">{children}</main>

          <footer className="border-border text-muted-foreground mt-16 border-t pt-6">
            <SocialLinks />
          </footer>
        </div>
      </body>
    </html>
  );
}
