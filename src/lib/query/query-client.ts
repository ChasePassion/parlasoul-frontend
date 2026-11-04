import { isServer, QueryClient } from "@tanstack/react-query";
import { ApiError, UnauthorizedError } from "@/lib/token-store";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof UnauthorizedError) {
    return false;
  }

  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }

  return failureCount < 2;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: MINUTE,
        gcTime: 10 * MINUTE,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}
