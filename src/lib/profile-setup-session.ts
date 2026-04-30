const PROFILE_SETUP_PENDING_USER_KEY = "parlasoul.profile_setup.pending_user_id";
const PROFILE_SETUP_LOGIN_INTENT_KEY = "parlasoul.profile_setup.login_intent";

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getSessionStorage(): BrowserStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function beginProfileSetupLoginIntent(
  storage: BrowserStorage | null = getSessionStorage(),
): void {
  storage?.setItem(PROFILE_SETUP_LOGIN_INTENT_KEY, "1");
}

export function markProfileSetupPending(
  userId: string,
  storage: BrowserStorage | null = getSessionStorage(),
): void {
  storage?.setItem(PROFILE_SETUP_PENDING_USER_KEY, userId);
  storage?.removeItem(PROFILE_SETUP_LOGIN_INTENT_KEY);
}

export function clearProfileSetupState(
  storage: BrowserStorage | null = getSessionStorage(),
): void {
  storage?.removeItem(PROFILE_SETUP_PENDING_USER_KEY);
  storage?.removeItem(PROFILE_SETUP_LOGIN_INTENT_KEY);
}

export function hasProfileSetupLoginIntent(
  storage: BrowserStorage | null = getSessionStorage(),
): boolean {
  return storage?.getItem(PROFILE_SETUP_LOGIN_INTENT_KEY) === "1";
}

export function isProfileSetupPendingForUser(
  userId: string,
  storage: BrowserStorage | null = getSessionStorage(),
): boolean {
  return storage?.getItem(PROFILE_SETUP_PENDING_USER_KEY) === userId;
}

export function canContinueProfileSetup(
  userId: string,
  storage: BrowserStorage | null = getSessionStorage(),
): boolean {
  return (
    isProfileSetupPendingForUser(userId, storage) ||
    hasProfileSetupLoginIntent(storage)
  );
}
