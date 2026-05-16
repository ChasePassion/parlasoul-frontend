import { authClient } from "./auth-client";
import { logger, Module, AuthEvent } from "./logger";

const DEFAULT_JWT_CACHE_MS = 14 * 60 * 1000;

let cachedJwt: string | null = null;
let cachedJwtExpiresAt = 0;
let inflightJwtPromise: Promise<string | null> | null = null;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return atob(padded);
}

function getJwtExpiry(token: string): number {
  try {
    const [, payloadSegment] = token.split(".");
    if (!payloadSegment) {
      return Date.now() + DEFAULT_JWT_CACHE_MS;
    }

    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as {
      exp?: number;
    };

    if (typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch {
    // Ignore malformed JWT payloads and fall back to a conservative cache TTL.
  }

  return Date.now() + DEFAULT_JWT_CACHE_MS;
}

async function requestBetterAuthJwt(): Promise<string | null> {
  const response = await authClient.token();
  const token = response.data?.token ?? null;

  if (!token) {
    logger.warn(Module.AUTH, AuthEvent.JWT_FAILED, "JWT token request returned empty", {
      has_data: !!response.data,
      has_error: !!response.error,
      error_code: response.error?.code,
    });
    clearBetterAuthJwt();
    return null;
  }

  cachedJwt = token;
  cachedJwtExpiresAt = getJwtExpiry(token);
  logger.info(Module.AUTH, AuthEvent.JWT_FETCHED, "JWT token acquired", {
    jwt_expires_in_ms: cachedJwtExpiresAt - Date.now(),
  });
  return token;
}

export async function getBetterAuthJwt(forceRefresh = false): Promise<string | null> {
  if (
    !forceRefresh &&
    cachedJwt &&
    Date.now() < cachedJwtExpiresAt - 5_000
  ) {
    return cachedJwt;
  }

  if (!inflightJwtPromise) {
    inflightJwtPromise = requestBetterAuthJwt().finally(() => {
      inflightJwtPromise = null;
    });
  }

  return inflightJwtPromise;
}

export function clearBetterAuthJwt(): void {
  cachedJwt = null;
  cachedJwtExpiresAt = 0;
  inflightJwtPromise = null;
}

async function buildAuthorizedHeaders(
  headers?: HeadersInit,
  forceRefresh = false,
): Promise<Headers> {
  const resolvedHeaders = new Headers(headers ?? {});
  const token = await getBetterAuthJwt(forceRefresh);

  if (token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  } else {
    resolvedHeaders.delete("Authorization");
  }

  return resolvedHeaders;
}

export async function fetchWithBetterAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { retryOnUnauthorized?: boolean } = {},
): Promise<Response> {
  const { retryOnUnauthorized = true } = options;
  const firstHeaders = await buildAuthorizedHeaders(init.headers);
  const hasAuth = !!firstHeaders.get("Authorization");
  const urlShort = String(input).split("/").slice(-2).join("/");
  logger.info(Module.AUTH, AuthEvent.PROFILE_FETCH_STARTED, `API request with auth`, {
    url: urlShort,
    has_auth_header: hasAuth,
    retry_enabled: retryOnUnauthorized,
  });

  const firstResponse = await fetch(input, {
    ...init,
    headers: firstHeaders,
  });

  logger.info(Module.AUTH, AuthEvent.PROFILE_FETCH_RESULT, `API response`, {
    url: urlShort,
    status: firstResponse.status,
    has_auth_header: hasAuth,
  });

  if (firstResponse.status !== 401 || !retryOnUnauthorized) {
    return firstResponse;
  }

  clearBetterAuthJwt();
  const retryHeaders = await buildAuthorizedHeaders(init.headers, true);
  const previousAuth = firstHeaders.get("Authorization");
  const retryAuth = retryHeaders.get("Authorization");

  logger.info(Module.AUTH, AuthEvent.JWT_FETCHED, "Retrying after 401 with refreshed JWT", {
    url: urlShort,
    previous_auth_present: !!previousAuth,
    retry_auth_present: !!retryAuth,
    same_token: retryAuth === previousAuth,
  });

  if (!retryAuth || retryAuth === previousAuth) {
    return firstResponse;
  }

  try {
    await firstResponse.body?.cancel();
  } catch {
    // Ignore body cancellation errors during retry handoff.
  }

  return fetch(input, {
    ...init,
    headers: retryHeaders,
  });
}
