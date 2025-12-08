import {
  Login,
  LoginDescription,
  LoginHeader,
  LoginTitle,
} from "@zoonk/ui/patterns/auth/login";
import { SocialLogin } from "./social-login";

export default function LoginPage() {
  return (
    <Login>
      <LoginHeader>
        <LoginTitle>Access our admin panel</LoginTitle>

        <LoginDescription>
          Use your Zoonk Google account to sign in.
        </LoginDescription>
      </LoginHeader>

      <SocialLogin />
    </Login>
  );
}
