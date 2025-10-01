import type { Metadata } from "next";
import { OTPForm } from "./OTPForm";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function OTPPage({
  searchParams,
}: PageProps<"/[locale]/otp">) {
  const { email } = await searchParams;

  return <OTPForm email={email as string} />;
}
