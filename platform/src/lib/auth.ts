import { redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";

export async function requireWorkOsUser(returnPathname?: string) {
  const auth = await getAuth();
  if (!auth.user) {
    const href = await getSignInUrl(
      returnPathname ? { data: { returnPathname } } : undefined,
    );
    throw redirect({ href });
  }
  return auth.user;
}
