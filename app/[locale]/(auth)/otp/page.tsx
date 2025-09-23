import { OTPForm } from "./OTPForm";

export const dynamic = "force-dynamic";

export default async function OTPPage({
  searchParams,
}: PageProps<"/[locale]/otp">) {
  const { email } = await searchParams;

  return <OTPForm email={email as string} />;
}
