import type { User } from "./api-service";

export type BackendProfileStatus = "anonymous" | "loading" | "loaded" | "error";

export function isProfileComplete(user: User | null): boolean {
  return !!(user?.username && user?.avatar_image_key);
}

export function isProfileStatusComplete(
  profileStatus: BackendProfileStatus,
  user: User | null,
): boolean {
  return profileStatus === "loaded" && isProfileComplete(user);
}

export function isProfileStatusIncomplete(
  profileStatus: BackendProfileStatus,
  user: User | null,
): boolean {
  return profileStatus === "loaded" && !!user && !isProfileComplete(user);
}
