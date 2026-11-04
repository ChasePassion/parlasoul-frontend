import assert from "node:assert/strict";
import test from "node:test";

import { mapApiError } from "./error-map";
import { ApiError, UnauthorizedError } from "./token-store";

test("maps API error codes to user-facing Chinese messages", () => {
  assert.deepEqual(
    mapApiError(
      new ApiError(403, "subscription_required", "subscription required"),
    ),
    {
      code: "subscription_required",
      message: "当前功能需要升级到 Plus 或 Pro 套餐后才能使用",
      severity: "warning",
      rawMessage: "subscription required",
    },
  );
});

test("maps effective entitlement conflicts to a non-blocking purchase message", () => {
  assert.deepEqual(
    mapApiError(
      new ApiError(
        409,
        "resource_conflict",
        "current effective tier already covers requested purchase",
      ),
    ),
    {
      code: "resource_conflict",
      message: "你当前已有有效权益，暂不可重复购买该档位",
      severity: "info",
      rawMessage: "current effective tier already covers requested purchase",
    },
  );
});

test("maps unpublished character errors consistently across API and runtime errors", () => {
  const expected = {
    code: "character_unpublished",
    message: "该角色已被作者下架，当前仅支持查看历史记录",
    severity: "warning",
    rawMessage: "resource not found: character is unpublished",
  };

  assert.deepEqual(
    mapApiError(
      new ApiError(404, "resource_not_found", expected.rawMessage),
    ),
    expected,
  );
  assert.deepEqual(mapApiError(new Error(expected.rawMessage)), expected);
});

test("maps upstream speech preprocessing codes from structured error details", () => {
  assert.deepEqual(
    mapApiError(
      new ApiError(
        502,
        "external_error",
        "external error: http_status=400; upstream_code=Audio.SpeechNotDetectedError; upstream_message=no speech; request_id=req_1",
      ),
    ),
    {
      code: "Audio.SpeechNotDetectedError",
      message: "未检测到语音内容，请确保音频包含至少3秒的清晰朗读",
      severity: "error",
      rawMessage: "no speech",
    },
  );
});

test("maps authorization and network errors without leaking raw English as UI copy", () => {
  assert.equal(mapApiError(new UnauthorizedError()).message, "登录已过期，请重新登录");
  assert.deepEqual(
    mapApiError(new Error("Failed to fetch")),
    {
      code: "NETWORK_ERROR",
      message: "网络连接失败，请检查网络",
      severity: "error",
      rawMessage: "Failed to fetch",
    },
  );
});
