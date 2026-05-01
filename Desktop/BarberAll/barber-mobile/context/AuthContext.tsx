import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LoginResponse } from "@/services/api";

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

  useEffect(() => {
    AsyncStorage.getItem("session")
      .then((raw: string | null) => {
        if (raw) setSession(JSON.parse(raw) as LoginResponse);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = async (s: LoginResponse) => {
    await AsyncStorage.setItem("session", JSON.stringify(s));
    await AsyncStorage.setItem("access_token", s.access_token);
    setSession(s);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem("session");
    await AsyncStorage.removeItem("access_token");
    setSession(null);
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
