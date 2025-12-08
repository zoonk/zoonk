import { FullPageContainer } from "@zoonk/ui/components/container";
import { LogoutButton } from "@/components/logout-button";

export default function Unauthorized() {
  return (
    <FullPageContainer className="antialiased">
      <header className="flex flex-col items-center gap-2">
        <h1 className="font-bold text-xl">401 - Unauthorized</h1>
        <p className="text-center text-sm">
          Log in with a different account to access this page.
        </p>
      </header>
      <LogoutButton />
    </FullPageContainer>
  );
}
