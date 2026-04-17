import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  getAuth,
  getSignInUrl,
  getSignUpUrl,
} from "@workos/authkit-tanstack-react-start";
import { Button } from "../components/ui/button";
import { AuthShell } from "../components/auth-shell";

export const Route = createFileRoute("/signin")({
  loader: async () => {
    const { user } = await getAuth();
    if (user) {
      throw redirect({ to: "/" });
    }
    const signInUrl = await getSignInUrl();
    const signUpUrl = await getSignUpUrl();
    return { signInUrl, signUpUrl };
  },
  component: SignInPage,
});

function SignInPage() {
  const { signInUrl, signUpUrl } = Route.useLoaderData();

  return (
    <AuthShell
      footer={
        <>
          By continuing you agree to our{" "}
          <a href="https://zocket.io/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Terms
          </a>{" "}
          and{" "}
          <a href="https://zocket.io/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Privacy Policy
          </a>
          .
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Welcome to Zocket
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time application infrastructure. Sign in or create an account to continue.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <a href={signInUrl}>Sign in</a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full">
            <a href={signUpUrl}>Create account</a>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
