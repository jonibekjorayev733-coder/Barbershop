import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LoginResponse, verifyAuthToken } from "@/services/api";
import { subscribeAuthUnauthorized } from "@/lib/authEvents";

function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decode = typeof globalThis.atob === "function" ? globalThis.atob(base64) : "";
    if (!decode) return false;

    const payload = JSON.parse(decode) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

interface AuthContextType {
  session: LoginResponse | null;
  isLoading: boolean;
  signIn: (session: LoginResponse) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(async () => {
    await AsyncStorage.removeItem("session");
    await AsyncStorage.removeItem("access_token");
    setSession(null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [rawSession, rawToken] = await Promise.all([
          AsyncStorage.getItem("session"),
          AsyncStorage.getItem("access_token"),
        ]);

        if (!rawSession || !rawToken) {
          setSession(null);
          return;
        }

        const parsed = JSON.parse(rawSession) as LoginResponse;

        if (isJwtExpired(rawToken)) {
          await clearSession();
          return;
        }

        setSession(parsed);

        try {
          await verifyAuthToken();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          const isNetworkIssue = message.includes("internet") || message.includes("network") || message.includes("timeout") || message.includes("sekin");
          if (!isNetworkIssue) {
            await clearSession();
          }
        }
      } catch {
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [clearSession]);

  useEffect(() => {
    const unsubscribe = subscribeAuthUnauthorized(() => {
      void clearSession();
    });

    return unsubscribe;
  }, [clearSession]);

  const signIn = async (s: LoginResponse) => {
    await AsyncStorage.setItem("session", JSON.stringify(s));
    await AsyncStorage.setItem("access_token", s.access_token);
    setSession(s);
  };

  const signOut = async () => {
    await clearSession();
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
