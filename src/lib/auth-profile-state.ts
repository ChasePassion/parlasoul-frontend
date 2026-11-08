import type { User } from "./api-service";

export type BackendProfileStatus = "anonymous" | "loading" | "loaded" | "error";

export function isProfileComplete(user: User | null): boolean {
  return !!(user?.username && (user?.avatar_image_key || user?.avatar_url));
}

export function isProfileStatusComplete(
  profileStatus: BackendProfileStatus,
  user: User | null,
): boolean {
  return profileStatus === "loaded" && isProfileComplete(user);
}
