import { useEffect, useMemo, useState } from "react";
import "./App.css";
import "./panels-pro-fix.css";
import { BarbersPage } from "./features/admin-panel/components/BarbersPage";
import { BookingsPage } from "./features/admin-panel/components/BookingsPage";
import { DashboardPage } from "./features/admin-panel/components/DashboardPage";
import { Sidebar } from "./features/admin-panel/components/Sidebar";
import { Topbar } from "./features/admin-panel/components/Topbar";
import {
  getAdminProfile,
  getBarberProfile,
  getStudentProfile,
  verifyToken,
  type LoginResponse,
} from "./features/admin-panel/api";
import { LoginPage } from "./features/auth/LoginPage";
import { BarberPanel } from "./features/barber-panel/BarberPanel";
import { UserPanel } from "./features/user-panel/UserPanel";
import { LocationGatePage } from "./features/public/LocationGatePage";
import { PublicLoginPage } from "./features/public/PublicLoginPage";
import type { Page } from "./features/admin-panel/types";
import { subscribeProfileSync } from "./lib/profileSync";

interface AppSession {
  accessToken: string;
  userId: number;
  role: "admin" | "barber" | "user";
  name: string;
  email: string;
  avatar: string | null;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = "sharpcuts_session";
const PREFERRED_BARBER_STORAGE_KEY = "sharpcuts_preferred_barber";
const PREAUTH_LOCATION_READY_KEY = "sharpcuts_preauth_location_ready";
const PREAUTH_LOCATION_COORDS_KEY = "sharpcuts_preauth_location_coords";

function readPreferredBarberId(): number | null {
  try {
    const raw = sessionStorage.getItem(PREFERRED_BARBER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function persistSession(session: AppSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    const fallbackSession = { ...session, avatar: null };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(fallbackSession));
  }
}

function parseJwtExp(accessToken: string): number {
  try {
    const payloadBase64 = accessToken.split(".")[1];
    if (!payloadBase64) {
      return Date.now() + 10 * 60 * 1000;
    }

    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(normalized)) as { exp?: number };
    if (typeof decoded.exp === "number" && decoded.exp > 0) {
      return decoded.exp * 1000;
    }
  } catch {
    return Date.now() + 10 * 60 * 1000;
  }

  return Date.now() + 10 * 60 * 1000;
}

function readStoredSession(): AppSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AppSession;
    if (!parsed?.accessToken || !parsed?.role || !parsed?.userId || !parsed?.expiresAt) {
      return null;
    }
    if (parsed.role !== "admin" && parsed.role !== "barber" && parsed.role !== "user") {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function toSession(response: LoginResponse): AppSession {
  const roleMap: Record<string, AppSession["role"]> = {
    admin: "admin",
    barber: "barber",
    student: "user",
    user: "user",
  };

  return {
    accessToken: response.access_token,
    userId: response.user_id,
    role: roleMap[response.role] ?? "user",
    name: response.name,
    email: response.email,
    avatar: response.avatar ?? null,
    expiresAt: parseJwtExp(response.access_token),
  };
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [session, setSession] = useState<AppSession | null>(() => readStoredSession());
  const [preferredBarberId] = useState<number | null>(() => readPreferredBarberId());
  const [isLocationGateDone, setIsLocationGateDone] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(PREAUTH_LOCATION_READY_KEY) === "1";
    } catch {
      return false;
    }
  });

  const isAdmin = session?.role === "admin";
  const isBarber = session?.role === "barber";
  const isUser = session?.role === "user";

  const userDisplayName = useMemo(() => {
    if (!session) {
      return "";
    }
    return session.name?.trim() || session.email;
  }, [session]);

  const handleLogin = (loginResponse: LoginResponse) => {
    const nextSession = toSession(loginResponse);
    setSession(nextSession);
    persistSession(nextSession);
    setPage("dashboard");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setPage("dashboard");
  };

  const handlePreauthLocationReady = (coords?: { lat: number; lng: number } | null) => {
    try {
      sessionStorage.setItem(PREAUTH_LOCATION_READY_KEY, "1");
      if (coords) {
        sessionStorage.setItem(PREAUTH_LOCATION_COORDS_KEY, JSON.stringify(coords));
      }
    } catch {
      return;
    }
    setIsLocationGateDone(true);
  };

  useEffect(() => {
    const clearSessionOnLeave = () => {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    };

    window.addEventListener("beforeunload", clearSessionOnLeave);
    window.addEventListener("pagehide", clearSessionOnLeave);

    return () => {
      window.removeEventListener("beforeunload", clearSessionOnLeave);
      window.removeEventListener("pagehide", clearSessionOnLeave);
    };
  }, []);

  const handleProfileUpdated = (payload: { name: string; email: string; avatar?: string | null }) => {
    setSession((current) => {
      if (!current) {
        return current;
      }

      const nextSession: AppSession = {
        ...current,
        name: payload.name,
        email: payload.email,
        avatar: payload.avatar !== undefined ? (payload.avatar ?? null) : current.avatar,
      };

      persistSession(nextSession);
      return nextSession;
    });
  };

  // keep backward-compat alias used by Topbar
  const handleAdminProfileUpdated = handleProfileUpdated;

  useEffect(() => {
    if (!session) {
      return;
    }

    const msUntilExpiry = session.expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      handleLogout();
      return;
    }

    const expiryTimeout = window.setTimeout(() => {
      handleLogout();
    }, msUntilExpiry);

    const verifyInterval = window.setInterval(() => {
      void verifyToken(session.accessToken).catch(() => {
        handleLogout();
      });
    }, 60 * 1000);

    return () => {
      window.clearTimeout(expiryTimeout);
      window.clearInterval(verifyInterval);
    };
  }, [session]);

  useEffect(() => {
    const handleStorageSession = (event: StorageEvent) => {
      if (event.key !== SESSION_STORAGE_KEY) {
        return;
      }

      setSession(readStoredSession());
    };

    const unsubscribe = subscribeProfileSync((payload) => {
      if (!session) {
        return;
      }

      const roleMatchesCurrentUser =
        (session.role === "admin" && payload.entityType === "admin" && payload.entityId === session.userId) ||
        (session.role === "barber" && payload.entityType === "barber" && payload.entityId === session.userId) ||
        (session.role === "user" && payload.entityType === "user" && payload.entityId === session.userId);

      if (!roleMatchesCurrentUser) {
        return;
      }

      setSession((current) => {
        if (!current) {
          return current;
        }

        const nextSession = {
          ...current,
          name: payload.name ?? current.name,
          email: payload.email ?? current.email,
          avatar: payload.avatar !== undefined ? (payload.avatar ?? null) : current.avatar,
        };

        persistSession(nextSession as AppSession);
        return nextSession;
      });
    });

    window.addEventListener("storage", handleStorageSession);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorageSession);
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const hydrateProfile = async () => {
      try {
        if (session.role === "admin") {
          const profile = await getAdminProfile(session.userId);
          handleProfileUpdated({ name: profile.name, email: profile.email, avatar: profile.avatar });
          return;
        }

        if (session.role === "barber") {
          const profile = await getBarberProfile(session.userId);
          handleProfileUpdated({ name: profile.name, email: profile.email, avatar: profile.photo_url });
          return;
        }

        const profile = await getStudentProfile(session.userId);
        handleProfileUpdated({ name: profile.name, email: profile.email ?? "", avatar: profile.avatar });
      } catch {
        return;
      }
    };

    void hydrateProfile();
  }, [session?.userId, session?.role]);

  if (!session) {
    if (!isLocationGateDone) {
      return <LocationGatePage onResolved={handlePreauthLocationReady} />;
    }
    return <PublicLoginPage onLogin={handleLogin} />;
  }

  if (isBarber) {
    return <BarberPanel barberId={session.userId} barberName={userDisplayName} barberEmail={session.email} barberAvatar={session.avatar} onProfileUpdated={handleProfileUpdated} onLogout={handleLogout} />;
  }

  if (isUser) {
    return <UserPanel userId={session.userId} userName={userDisplayName} userEmail={session.email} userAvatar={session.avatar} preferredBarberId={preferredBarberId} onProfileUpdated={handleProfileUpdated} onLogout={handleLogout} />;
  }

  if (!isAdmin) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="layout">
      <Sidebar
        page={page}
        onChangePage={setPage}
        onLogout={handleLogout}
        adminName={session.name}
        adminAvatar={session.avatar}
      />

      <div className="main-wrap">
        <Topbar
          adminId={session.userId}
          adminName={session.name}
          adminEmail={session.email}
          adminAvatar={session.avatar}
          onProfileUpdated={handleAdminProfileUpdated}
        />

        <main className="content">
          {page === "dashboard" && <DashboardPage onNavigate={setPage} />}
          {page === "barbers" && <BarbersPage />}
          {page === "bookings" && <BookingsPage />}
        </main>
      </div>
    </div>
  );
}
