"use client";

import { useRef } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface AvatarUploadFieldProps {
  /** 当前预览图；为空时显示上传占位 */
  src: string | null;
  disabled?: boolean;
  isUploading?: boolean;
  onSelectFile: (file: File) => void;
}

/**
 * 头像上传块：虚线方框 + 点击/拖拽选图 + 悬停更换。
 * 校验、裁剪与上传由调用方处理。
 */
export default function AvatarUploadField({
  src,
  disabled = false,
  isUploading = false,
  onSelectFile,
}: AvatarUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = disabled || isUploading;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onSelectFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onSelectFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div>
      <div
        onClick={() => {
          if (!isBusy) fileInputRef.current?.click();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="relative mx-auto w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors overflow-hidden group"
      >
        {src ? (
          <>
            <Image
              src={src}
              alt="头像预览"
              fill
              className="object-cover"
              unoptimized={src.startsWith("data:")}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-white text-sm">更换头像</span>
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            <svg
              className="mx-auto h-8 w-8 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-xs text-gray-500 mt-1">点击上传</p>
          </div>
        )}

        {isUploading ? (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
      <p className="text-xs text-gray-400 text-center mt-2">
        支持 JPEG, PNG, WEBP，最大 5MB
      </p>
    </div>
  );
}
