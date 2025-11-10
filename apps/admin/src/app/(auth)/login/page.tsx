import { SocialLogin } from "./social-login";

export default function Login() {
  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2">
        <h1 className="font-bold text-xl">Access our admin panel</h1>

        <p className="text-center text-sm">
          Use your Zoonk Google account to sign in.
        </p>
      </header>

      <SocialLogin />
    </main>
  );
}
