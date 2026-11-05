import assert from "node:assert/strict";
import test from "node:test";

import { mapApiError } from "./error-map";
import { ApiError, UnauthorizedError } from "./token-store";

test("maps subscription_required to a warning carrying the raw detail", () => {
  const mapped = mapApiError(
    new ApiError(403, "subscription_required", "subscription required"),
  );

  assert.equal(mapped.code, "subscription_required");
  assert.equal(mapped.severity, "warning");
  assert.equal(mapped.rawMessage, "subscription required");
});

test("maps effective entitlement conflicts to a non-blocking result", () => {
  const detail = "current effective tier already covers requested purchase";

  const mapped = mapApiError(new ApiError(409, "resource_conflict", detail));

  assert.equal(mapped.code, "resource_conflict");
  assert.equal(mapped.severity, "info");
  assert.equal(mapped.rawMessage, detail);
});

test("maps unpublished character errors consistently across API and runtime errors", () => {
  const detail = "resource not found: character is unpublished";

  const fromApi = mapApiError(new ApiError(404, "resource_not_found", detail));
  const fromRuntime = mapApiError(new Error(detail));

  assert.deepEqual(fromApi, fromRuntime);
  assert.equal(fromApi.code, "character_unpublished");
  assert.equal(fromApi.severity, "warning");
});

test("extracts upstream speech error codes from structured details", () => {
  const mapped = mapApiError(
    new ApiError(
      502,
      "external_error",
      "external error: http_status=400; upstream_code=Audio.SpeechNotDetectedError; upstream_message=no speech; request_id=req_1",
    ),
  );

  assert.equal(mapped.code, "Audio.SpeechNotDetectedError");
  assert.equal(mapped.severity, "error");
  assert.equal(mapped.rawMessage, "no speech");
});

test("classifies authorization and network failures by stable codes", () => {
  const unauthorized = mapApiError(new UnauthorizedError());
  assert.equal(unauthorized.code, "authorization failed");
  assert.equal(unauthorized.severity, "error");

  const network = mapApiError(new Error("Failed to fetch"));
  assert.equal(network.code, "NETWORK_ERROR");
  assert.equal(network.severity, "error");
  assert.equal(network.rawMessage, "Failed to fetch");
});
