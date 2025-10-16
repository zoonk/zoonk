import "@zoonk/ui/globals.css";
import { Container } from "@zoonk/ui/components/container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evals Dashboard",
  description: "Run and monitor evaluations for AI tasks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Container className="py-8">{children}</Container>
      </body>
    </html>
  );
}
