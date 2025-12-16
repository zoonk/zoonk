import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { LogoutButton } from "@/components/logout-button";

export default function Unauthorized() {
  return (
    <Container variant="centered">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>401 - Unauthorized</ContainerTitle>
          <ContainerDescription>
            Log in with a different account to access this page.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="justify-end">
        <LogoutButton />
      </ContainerBody>
    </Container>
  );
}
