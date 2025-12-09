import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { LogoutButton } from "@/components/logout-button";

export default function Unauthorized() {
  return (
    <Container variant="centered">
      <ContainerHeader>
        <ContainerTitle>401 - Unauthorized</ContainerTitle>
        <ContainerDescription>
          Log in with a different account to access this page.
        </ContainerDescription>
      </ContainerHeader>

      <ContainerBody className="justify-end">
        <LogoutButton />
      </ContainerBody>
    </Container>
  );
}
