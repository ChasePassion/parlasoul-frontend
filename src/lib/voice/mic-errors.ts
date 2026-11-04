export type MicStartErrorCode =
  | "MIC_API_UNAVAILABLE"
  | "MIC_INSECURE_CONTEXT"
  | "MIC_PERMISSION_DENIED"
  | "MIC_DEVICE_NOT_FOUND"
  | "MIC_DEVICE_BUSY"
  | "MIC_CONSTRAINT_UNSUPPORTED"
  | "MIC_START_FAILED";

/**
 * Map a getUserMedia error to a structured MicStartErrorCode.
 */
export function mapMicStartError(err: unknown): MicStartErrorCode {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "MIC_INSECURE_CONTEXT";
  }

  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
      case "SecurityError":
        return "MIC_PERMISSION_DENIED";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "MIC_DEVICE_NOT_FOUND";
      case "NotReadableError":
      case "TrackStartError":
        return "MIC_DEVICE_BUSY";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "MIC_CONSTRAINT_UNSUPPORTED";
      default:
        return "MIC_START_FAILED";
    }
  }

  if (err instanceof TypeError) {
    return "MIC_API_UNAVAILABLE";
  }

  return "MIC_START_FAILED";
}

/**
 * Query the current microphone permission state.
 * Returns "unsupported" if the Permissions API is not available.
 */
export async function getMicPermissionState(): Promise<
  PermissionState | "unsupported"
> {
  if (typeof navigator === "undefined") {
    return "unsupported";
  }
  if (!("permissions" in navigator) || !navigator.permissions?.query) {
    return "unsupported";
  }
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return "unsupported";
  }
}
