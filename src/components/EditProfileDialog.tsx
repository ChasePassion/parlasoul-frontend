"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import AvatarCropper from "@/components/AvatarCropper";
import AvatarUploadField from "@/components/AvatarUploadField";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  updateUserProfile,
  uploadFile,
  type UpdateProfileRequest,
} from "@/lib/api";
import {
  PRESET_AVATAR_COUNT,
  PRESET_AVATAR_PREFIX,
} from "@/lib/auth-default-profile";
import { useAuth } from "@/lib/auth-context";
import { resolveUserAvatarSrc } from "@/lib/character-avatar";
import { getErrorMessage } from "@/lib/error-map";
import { queryKeys } from "@/lib/query";
import { cn } from "@/lib/utils";

const PRESET_AVATARS = Array.from(
  { length: PRESET_AVATAR_COUNT },
  (_, index) => `${PRESET_AVATAR_PREFIX}avatar-${String(index + 1).padStart(2, "0")}.webp`,
);

const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditProfileDialog({
  open,
  onOpenChange,
}: EditProfileDialogProps) {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [presetAvatar, setPresetAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<string | null>(null);

  const currentAvatarUrl = resolveUserAvatarSrc(user, "md");

  const clearUploadPreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setUploadPreviewUrl(null);
  };

  useEffect(() => {
    if (!open) return;
    setUsername(user?.username ?? "");
    setPresetAvatar(
      user?.avatar_url?.startsWith(PRESET_AVATAR_PREFIX) ? user.avatar_url : null,
    );
    setAvatarFile(null);
    clearUploadPreview();
    setCropperFile(null);
    setIsUploading(false);
    setError("");
    setIsSaving(false);
  }, [open, user?.username, user?.avatar_url]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const trimmedUsername = username.trim();
  const canSave =
    trimmedUsername.length >= 2 &&
    trimmedUsername.length <= 50 &&
    !isSaving &&
    !isUploading;

  const handleSelectFile = (file: File) => {
    setError("");
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
      setError("请选择 JPEG、PNG 或 WEBP 格式的图片！");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("图片大小不能超过 5MB！");
      return;
    }
    setCropperFile(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    setCropperFile(null);
    setPresetAvatar(null);
    clearUploadPreview();
    const previewUrl = URL.createObjectURL(blob);
    previewRef.current = previewUrl;
    setUploadPreviewUrl(previewUrl);
    // 与完善资料页一致：先本地预览，真正的上传放到保存时执行
    setAvatarFile(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    setError("");
  };

  const handleSave = async () => {
    if (!user || !canSave) return;

    setError("");
    setIsSaving(true);
    try {
      const payload: UpdateProfileRequest = {};
      if (trimmedUsername !== (user.username ?? "")) {
        payload.username = trimmedUsername;
      }
      if (avatarFile) {
        setIsUploading(true);
        const uploaded = await uploadFile(avatarFile, { kind: "user_avatar" });
        payload.avatar_image_key = uploaded.image_key;
      } else if (presetAvatar && presetAvatar !== user.avatar_url) {
        payload.avatar_url = presetAvatar;
      }

      if (Object.keys(payload).length === 0) {
        onOpenChange(false);
        return;
      }

      const updated = await updateUserProfile(payload);
      queryClient.setQueryData(queryKeys.user.profile(user.id), updated);
      try {
        await refreshUser();
      } catch (refreshError) {
        console.error("Failed to refresh user after profile update:", refreshError);
      }
      toast.success("资料已更新");
      onOpenChange(false);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 409) {
        setError("这个用户名已经被占用了，换一个试试");
      } else {
        setError(getErrorMessage(saveError));
      }
    } finally {
      setIsUploading(false);
      setIsSaving(false);
    }
  };

  const uploadPreview =
    uploadPreviewUrl ??
    (presetAvatar ? null : user?.avatar_image_key ? currentAvatarUrl : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>编辑资料</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-1">
          <div className="space-y-2">
            <Label htmlFor="edit-profile-username">用户名</Label>
            <Input
              id="edit-profile-username"
              value={username}
              maxLength={50}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="输入用户名"
              className="h-11"
            />
            <p className="text-xs text-gray-400">2–50 个字符，会展示在你的角色卡上</p>
          </div>

          <div className="space-y-3">
            <Label>头像</Label>
            <div className="grid grid-cols-5 gap-2.5">
              {PRESET_AVATARS.map((src) => {
                const isSelected = presetAvatar === src;
                return (
                  <button
                    key={src}
                    type="button"
                    aria-label={`选择头像 ${src}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      clearUploadPreview();
                      setAvatarFile(null);
                      setPresetAvatar(src);
                    }}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-xl border-2 transition-colors",
                      isSelected
                        ? "border-blue-600"
                        : "border-transparent hover:border-gray-300",
                    )}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="72px"
                      unoptimized
                      className="object-cover"
                    />
                  </button>
                );
              })}
            </div>

            <div className="pt-1">
              <AvatarUploadField
                src={uploadPreview}
                isUploading={isUploading}
                disabled={isSaving}
                onSelectFile={handleSelectFile}
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isUploading}
          >
            取消
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {cropperFile ? (
        <AvatarCropper
          file={cropperFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropperFile(null)}
        />
      ) : null}
    </Dialog>
  );
}
