import { getSession } from "@zoonk/api/users";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: LayoutProps<"/login">) {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      {children}
    </div>
  );
}
