import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  getAuth,
  getSignInUrl,
  getSignUpUrl,
} from "@workos/authkit-tanstack-react-start";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

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
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <span className="font-heading text-xl font-bold text-primary-foreground">Z</span>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Welcome to Zocket</h1>
            <p className="text-sm text-muted-foreground">Real-time application platform</p>
          </div>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>
              Authentication runs through WorkOS AuthKit. Your workspace is provisioned on first login.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <a href={signInUrl}>Continue with WorkOS</a>
            </Button>
            <Button asChild variant="secondary">
              <a href={signUpUrl}>Create account</a>
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <Button asChild variant="link" size="sm">
              <a href="/">Go to dashboard</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
