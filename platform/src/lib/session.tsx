import {
  createContext,
  startTransition,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { getApi, requireApiData } from "./api";

type SessionState = {
  ready: boolean;
  workosUser: {
    id: string | null;
    email: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  approveDeviceFlow(deviceCode: string): Promise<void>;
  signOut(): Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider(props: PropsWithChildren) {
  const { user: workosUser, loading: authLoading, signOut: workosSignOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const ready = !authLoading && !signingOut;

  async function approveDeviceFlow(deviceCode: string) {
    if (!workosUser?.email) {
      throw new Error("WorkOS user is required to approve a device flow");
    }
    const api = getApi();
    await requireApiData(await api.auth.device({ deviceCode }).approve.post());
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await workosSignOut();
    } finally {
      startTransition(() => {
        setSigningOut(false);
      });
    }
  }

  return (
    <SessionContext.Provider
      value={{
        ready,
        workosUser: workosUser
          ? {
              id: workosUser.id ?? null,
              email: workosUser.email ?? null,
              firstName: workosUser.firstName,
              lastName: workosUser.lastName,
            }
          : null,
        approveDeviceFlow,
        signOut,
      }}
    >
      {props.children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("SessionProvider is missing");
  }
  return value;
}
