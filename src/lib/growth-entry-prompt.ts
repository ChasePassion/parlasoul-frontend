"use client";

export const GROWTH_ENTRY_DISMISS_KEY =
  "growth_entry_popup_dismissed_stat_date_v1";
export const GROWTH_ENTRY_SESSION_HANDLED_KEY =
  "growth_entry_popup_handled_stat_date_v1";

export function getGrowthEntryDismissKey(userId?: string | null): string {
  if (!userId) {
    return GROWTH_ENTRY_DISMISS_KEY;
  }

  return `${GROWTH_ENTRY_DISMISS_KEY}:${userId}`;
}

export function getGrowthEntrySessionHandledKey(
  userId?: string | null,
): string {
  if (!userId) {
    return GROWTH_ENTRY_SESSION_HANDLED_KEY;
  }

  return `${GROWTH_ENTRY_SESSION_HANDLED_KEY}:${userId}`;
}

interface GrowthEntryPromptDecision {
  statDate: string | null | undefined;
  dismissedStatDate: string | null | undefined;
}

interface GrowthEntrySessionDecision {
  statDate: string | null | undefined;
  lastHandledStatDate: string | null | undefined;
}

export function shouldEvaluateGrowthEntryAutoOpenForSession({
  statDate,
  lastHandledStatDate,
}: GrowthEntrySessionDecision): boolean {
  return !!statDate && statDate !== lastHandledStatDate;
}

export function shouldAutoOpenGrowthEntryPopup({
  statDate,
  dismissedStatDate,
}: GrowthEntryPromptDecision): boolean {
  return !!statDate && dismissedStatDate !== statDate;
}

type StorageReader = Pick<Storage, "getItem"> | null | undefined;
type StorageWriter = Pick<Storage, "setItem"> | null | undefined;

function resolveReader(storage?: StorageReader): StorageReader {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function resolveWriter(storage?: StorageWriter): StorageWriter {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function resolveSessionReader(storage?: StorageReader): StorageReader {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function resolveSessionWriter(storage?: StorageWriter): StorageWriter {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

export function readGrowthEntryDismissedStatDate(
  userId?: string | null,
  storage?: StorageReader,
): string | null {
  try {
    return (
      resolveReader(storage)?.getItem(getGrowthEntryDismissKey(userId)) ?? null
    );
  } catch {
    return null;
  }
}

export function dismissGrowthEntryForToday(
  statDate: string,
  userId?: string | null,
  storage?: StorageWriter,
): void {
  try {
    resolveWriter(storage)?.setItem(getGrowthEntryDismissKey(userId), statDate);
  } catch {
    // Ignore storage failures and keep the popup behavior functional.
  }
}

export function readGrowthEntryAutoOpenHandledStatDate(
  userId?: string | null,
  storage?: StorageReader,
): string | null {
  try {
    return (
      resolveSessionReader(storage)?.getItem(
        getGrowthEntrySessionHandledKey(userId),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function markGrowthEntryAutoOpenHandledForSession(
  statDate: string,
  userId?: string | null,
  storage?: StorageWriter,
): void {
  try {
    resolveSessionWriter(storage)?.setItem(
      getGrowthEntrySessionHandledKey(userId),
      statDate,
    );
  } catch {
    // Ignore storage failures and keep the popup behavior functional.
  }
}
