import { LogoutButton } from "@/components/logout-button";

export default function Unauthorized() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 bg-background p-6 antialiased md:p-10">
      <header className="flex flex-col items-center gap-2">
        <h1 className="font-bold text-xl">401 - Unauthorized</h1>
        <p className="text-center text-sm">
          Log in with a different account to access this page.
        </p>
      </header>
      <LogoutButton />
    </main>
  );
}
