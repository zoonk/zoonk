import {
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
  FullPageContainer,
} from "@zoonk/ui/components/container";
import { LogoutButton } from "@/components/logout-button";

export default function Unauthorized() {
  return (
    <FullPageContainer className="antialiased">
      <ContainerHeader>
        <ContainerTitle>401 - Unauthorized</ContainerTitle>
        <ContainerDescription>
          Log in with a different account to access this page.
        </ContainerDescription>
      </ContainerHeader>

      <LogoutButton />
    </FullPageContainer>
  );
}
