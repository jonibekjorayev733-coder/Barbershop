export type ProfileEntityType = "admin" | "barber" | "user";

export interface ProfileSyncPayload {
  entityType: ProfileEntityType;
  entityId: number;
  name?: string;
  email?: string;
  avatar?: string | null;
}

const PROFILE_SYNC_STORAGE_KEY = "sharpcuts_profile_sync";
const PROFILE_SYNC_EVENT = "sharpcuts:profile-sync";

export function emitProfileSync(payload: ProfileSyncPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = {
    ...payload,
    avatar: payload.avatar ?? null,
    timestamp: Date.now(),
  };

  try {
    window.localStorage.setItem(PROFILE_SYNC_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return;
  }

  window.dispatchEvent(new CustomEvent(PROFILE_SYNC_EVENT, { detail: normalized }));
}

export function subscribeProfileSync(handler: (payload: ProfileSyncPayload) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<ProfileSyncPayload>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== PROFILE_SYNC_STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      handler(JSON.parse(event.newValue) as ProfileSyncPayload);
    } catch {
      return;
    }
  };

  window.addEventListener(PROFILE_SYNC_EVENT, handleCustomEvent as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(PROFILE_SYNC_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
}
