import { ApiError } from "./token-store";

export type ErrorSeverity = "error" | "warning" | "info";

export interface MappedError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  rawMessage?: string;
}

interface ErrorMapping {
  message: string;
  severity: ErrorSeverity;
}

const ERROR_MESSAGE_MAP: Record<string, ErrorMapping> = {
  DEFAULT: { message: "操作失败，请稍后重试", severity: "error" },
  NETWORK_ERROR: { message: "网络连接失败，请检查网络", severity: "error" },

  "400": { message: "请求参数有误，请检查输入", severity: "error" },
  "401": { message: "登录已过期，请重新登录", severity: "error" },
  "403": { message: "无权执行此操作", severity: "error" },
  "404": { message: "请求的资源不存在", severity: "error" },
  "409": { message: "操作冲突，请稍后重试", severity: "error" },
  "422": { message: "数据验证失败，请检查输入内容", severity: "error" },
  "429": { message: "请求过于频繁，请稍后再试", severity: "warning" },
  "500": { message: "服务器内部错误，请稍后重试", severity: "error" },
  "502": { message: "服务暂时不可用，请稍后重试", severity: "error" },
  "503": { message: "服务暂时不可用，请稍后重试", severity: "error" },

  // 阿里云语音克隆错误码
  "Audio.DurationLimitError": {
    message: "音频时长超过限制，请上传10~60秒的音频",
    severity: "error",
  },
  "Audio.FormatError": {
    message: "不支持的音频格式，请上传 WAV、MP3 或 M4A 格式",
    severity: "error",
  },
  "Audio.QualityError": {
    message: "音频质量不佳，请确保音频清晰无噪音",
    severity: "error",
  },
  "Audio.FileTooLargeError": {
    message: "音频文件过大，请上传小于 10MB 的文件",
    severity: "error",
  },
  "Audio.PreprocessError": {
    message: "音频预处理失败，请确保音频内容清晰无背景音",
    severity: "error",
  },
  "Audio.SilentAudioError": {
    message: "音频内容过于安静或无声音，请重新录音",
    severity: "error",
  },
  "Audio.SpeechNotDetectedError": {
    message: "未检测到语音内容，请确保音频包含至少3秒的清晰朗读",
    severity: "error",
  },

  // 语音合成相关
  "VoiceClone.CreateFailed": {
    message: "音色克隆创建失败，请稍后重试",
    severity: "error",
  },
  "VoiceClone.ProcessingFailed": {
    message: "音色处理失败，请重新上传音频",
    severity: "error",
  },
  "TTS.VoiceNotReady": {
    message: "音色尚未就绪，请稍后重试",
    severity: "warning",
  },
  "TTS.VoiceNotFound": {
    message: "音色不存在或已被删除",
    severity: "error",
  },
  voice_profile_not_selectable: {
    message: "当前所选克隆音色不可用，请重新选择你的可用音色",
    severity: "error",
  },
  voice_profile_not_ready: {
    message: "音色尚未就绪，请稍后再试听",
    severity: "warning",
  },
  voice_preview_text_missing: {
    message: "该音色还没有试听文本，请先编辑补充",
    severity: "warning",
  },
  voice_preview_not_supported: {
    message: "当前音色不支持这种试听方式",
    severity: "error",
  },
  voice_not_found: {
    message: "当前所选音色不存在或与模型不匹配，请重新选择",
    severity: "error",
  },

  // STT 相关
  "STT.NoSpeech": {
    message: "未检测到语音，请重试",
    severity: "info",
  },
  "STT.TranscriptionFailed": {
    message: "语音转写失败，请重试",
    severity: "error",
  },

  // 麦克风相关
  MIC_PERMISSION_DENIED: {
    message: "请在浏览器设置中允许使用麦克风",
    severity: "warning",
  },
  MIC_DEVICE_NOT_FOUND: {
    message: "未检测到可用麦克风",
    severity: "error",
  },
  MIC_DEVICE_BUSY: {
    message: "麦克风正被其他应用占用",
    severity: "warning",
  },
  MIC_INSECURE_CONTEXT: {
    message: "请在 https 或 localhost 环境下使用麦克风",
    severity: "error",
  },
  MIC_API_UNAVAILABLE: {
    message: "请在 https 或 localhost 环境下使用麦克风",
    severity: "error",
  },
  MIC_START_FAILED: {
    message: "无法启动录音",
    severity: "error",
  },
  NO_SPEECH: {
    message: "似乎没有听到声音哦",
    severity: "info",
  },

  // 授权/认证相关
  unauthorized: {
    message: "登录已过期，请重新登录",
    severity: "error",
  },
  "authorization failed": {
    message: "登录已过期，请重新登录",
    severity: "error",
  },
  "You must be logged in to checkout": {
    message: "请先登录后再发起购买",
    severity: "warning",
  },
  "User email not verified": {
    message: "当前账号邮箱尚未验证，暂时无法管理订阅",
    severity: "warning",
  },
  "Product not found": {
    message: "当前套餐暂时不可购买，请稍后重试",
    severity: "error",
  },
  "Checkout session creation failed": {
    message: "创建支付会话失败，请稍后重试",
    severity: "error",
  },
  "Customer portal creation failed": {
    message: "打开订阅管理失败，请稍后重试",
    severity: "error",
  },
  "DodoPayments subscriptions list failed": {
    message: "获取订阅列表失败，请稍后重试",
    severity: "error",
  },
  "Orders list failed": {
    message: "获取支付记录失败，请稍后重试",
    severity: "error",
  },
  subscription_required: {
    message: "当前功能需要升级到 Plus 或 Pro 套餐后才能使用",
    severity: "warning",
  },
  subscription_expired: {
    message: "当前订阅已失效，请续费后继续使用该功能",
    severity: "warning",
  },
  feature_not_enabled: {
    message: "该功能当前处于关闭状态，请开启后再试",
    severity: "info",
  },

  // API 层通用错误
  "No response body": {
    message: "服务器响应异常，请稍后重试",
    severity: "error",
  },
  "Unknown error": {
    message: "操作失败，请稍后重试",
    severity: "error",
  },
};

interface AlibabaCloudError {
  http_status?: number;
  upstream_code?: string;
  upstream_message?: string;
  request_id?: string;
}

function parseAlibabaCloudError(errorMessage: string): AlibabaCloudError | null {
  if (!errorMessage.includes("upstream_code=")) {
    return null;
  }

  const httpStatusMatch = errorMessage.match(/http_status=(\d+)/);
  const upstreamCodeMatch = errorMessage.match(/upstream_code=([^;]+)/);
  const upstreamMessageMatch = errorMessage.match(/upstream_message=([^;]+)/);
  const requestIdMatch = errorMessage.match(/request_id=([^\s;]+)/);

  return {
    http_status: httpStatusMatch ? parseInt(httpStatusMatch[1], 10) : undefined,
    upstream_code: upstreamCodeMatch ? upstreamCodeMatch[1].trim() : undefined,
    upstream_message: upstreamMessageMatch ? upstreamMessageMatch[1].trim() : undefined,
    request_id: requestIdMatch ? requestIdMatch[1].trim() : undefined,
  };
}

export function mapApiError(error: unknown): MappedError {
  if (error instanceof ApiError) {
    const statusKey = error.status?.toString() || "DEFAULT";
    const codeKey = error.code || statusKey;

    if (error.detail?.includes("character is unpublished")) {
      return {
        code: "character_unpublished",
        message: "该角色已被作者下架，当前仅支持查看历史记录",
        severity: "warning",
        rawMessage: error.detail,
      };
    }

    const parsed = error.detail ? parseAlibabaCloudError(error.detail) : null;
    if (parsed && parsed.upstream_code) {
      const upstreamMapped = ERROR_MESSAGE_MAP[parsed.upstream_code];
      if (upstreamMapped) {
        return {
          code: parsed.upstream_code,
          message: upstreamMapped.message,
          severity: upstreamMapped.severity,
          rawMessage: parsed.upstream_message || error.detail,
        };
      }
    }

    const mapped = ERROR_MESSAGE_MAP[codeKey] || ERROR_MESSAGE_MAP[statusKey];

    return {
      code: codeKey,
      message: mapped?.message || ERROR_MESSAGE_MAP.DEFAULT.message,
      severity: mapped?.severity || "error",
      rawMessage: error.detail || error.message,
    };
  }

  if (error instanceof Error) {
    if (error.message.includes("character is unpublished")) {
      return {
        code: "character_unpublished",
        message: "该角色已被作者下架，当前仅支持查看历史记录",
        severity: "warning",
        rawMessage: error.message,
      };
    }

    const parsed = parseAlibabaCloudError(error.message);
    if (parsed && parsed.upstream_code) {
      const upstreamMapped = ERROR_MESSAGE_MAP[parsed.upstream_code];
      if (upstreamMapped) {
        return {
          code: parsed.upstream_code,
          message: upstreamMapped.message,
          severity: upstreamMapped.severity,
          rawMessage: parsed.upstream_message || error.message,
        };
      }
    }

    const knownError = ERROR_MESSAGE_MAP[error.message];
    if (knownError) {
      return {
        code: error.message,
        message: knownError.message,
        severity: knownError.severity,
        rawMessage: error.message,
      };
    }

    if (error.message.startsWith("authorization failed:")) {
      return {
        code: "authorization failed",
        message: ERROR_MESSAGE_MAP["authorization failed"].message,
        severity: "error",
        rawMessage: error.message,
      };
    }

    if (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed to fetch")
    ) {
      return {
        code: "NETWORK_ERROR",
        message: ERROR_MESSAGE_MAP.NETWORK_ERROR.message,
        severity: "error",
        rawMessage: error.message,
      };
    }

    return {
      code: "UNKNOWN",
      message: ERROR_MESSAGE_MAP.DEFAULT.message,
      severity: "error",
      rawMessage: error.message,
    };
  }

  return {
    code: "DEFAULT",
    message: ERROR_MESSAGE_MAP.DEFAULT.message,
    severity: "error",
  };
}

export function getErrorMessage(error: unknown): string {
  return mapApiError(error).message;
}

export function isSevereError(error: unknown): boolean {
  return mapApiError(error).severity === "error";
}
