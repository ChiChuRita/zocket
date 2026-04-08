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
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Create your first workspace</CardTitle>
          <CardDescription>
            Browser authentication runs through WorkOS AuthKit. The platform
            workspace is provisioned on first login.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <a href={signInUrl}>Continue with WorkOS</a>
          </Button>
          <Button asChild variant="secondary">
            <a href={signUpUrl}>Create account</a>
          </Button>
          <p>
            After callback, the dashboard provisions your workspace automatically.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild variant="link">
            <a href="/">Go to dashboard</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
