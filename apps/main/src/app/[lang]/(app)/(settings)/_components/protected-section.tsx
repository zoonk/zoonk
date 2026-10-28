import { AuthGate } from "@/components/auth-gate";
import { getSession } from "@zoonk/core/users/session";

export async function ProtectedSection({
  allowGuests = false,
  children,
  next,
}: {
  allowGuests?: boolean;
  children: React.ReactNode;
  next: string;
}) {
  const session = await getSession();

  if (!session || (session.user.isAnonymous && !allowGuests)) {
    return <AuthGate next={next} />;
  }

  return children;
}
