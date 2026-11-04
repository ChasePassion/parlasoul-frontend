"use client";

import { apiService } from "./api-service";
import type { ChatImageRef } from "./api-service";

export interface ChatImageUploadResult {
  ref: ChatImageRef;
  imageKey: string;
}

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (Math.max(width, height) > MAX_DIMENSION) {
        const ratio = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("压缩失败"));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}

export async function uploadChatImage(file: File): Promise<ChatImageUploadResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("不支持的图片格式");
  if (file.size > MAX_FILE_SIZE) throw new Error("图片大小不能超过 5MB");

  const compressed = await compressImage(file);
  const result = await apiService.uploadFile(
    new File([compressed], file.name, { type: "image/jpeg" }),
    { kind: "chat_image" },
  );

  if (!result.original_url || !result.display_url) {
    throw new Error("上传结果缺少图片 URL");
  }

  return {
    ref: {
      image_key: result.image_key,
      original: result.original_url,
      display: result.display_url,
    },
    imageKey: result.image_key,
  };
}

export function validateImageFiles(
  files: FileList | File[],
  currentCount: number = 0,
  maxCount: number = 5,
): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];
  const remaining = maxCount - currentCount;

  for (const file of Array.from(files)) {
    if (valid.length >= remaining) {
      errors.push(`最多只能上传 ${maxCount} 张图片`);
      break;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      errors.push(`${file.name}: 不支持的格式`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: 超过 5MB 限制`);
      continue;
    }
    valid.push(file);
  }
  return { valid, errors };
}
