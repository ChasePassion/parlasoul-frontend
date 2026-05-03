"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    useAuth,
    isProfileStatusComplete,
    isProfileStatusIncomplete,
} from "@/lib/auth-context";
import { uploadFile, updateUserProfile } from "@/lib/api";
import {
    canContinueProfileSetup,
    clearProfileSetupState,
} from "@/lib/profile-setup-session";
import { UnauthorizedError } from "@/lib/token-store";
import AvatarCropper from "@/components/AvatarCropper";

export default function SetupPage() {
    const {
        user,
        isAuthed,
        isLoading: isAuthLoading,
        logout,
        refreshUser,
        profileStatus,
        profileError,
    } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [cropperFile, setCropperFile] = useState<File | null>(null); // For cropper
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isSetupAllowed =
        isProfileStatusIncomplete(profileStatus, user) &&
        !!user &&
        canContinueProfileSetup(user.id);
    const isProfileReady = isProfileStatusComplete(profileStatus, user);

    // Redirect if not authenticated, or if an incomplete session is no longer
    // part of the active setup flow in this tab.
    useEffect(() => {
        if (isAuthLoading) {
            return;
        }

        if (!isAuthed || !user) {
            clearProfileSetupState();
            router.replace("/login");
            return;
        }

        if (profileStatus === "error") {
            clearProfileSetupState();
            if (profileError instanceof UnauthorizedError) {
                void logout().finally(() => {
                    router.replace("/login");
                });
                return;
            }
            router.replace("/");
            return;
        }

        if (profileStatus !== "loaded") {
            return;
        }

        if (isProfileStatusIncomplete(profileStatus, user) && !canContinueProfileSetup(user.id)) {
            void logout().finally(() => {
                clearProfileSetupState();
                router.replace("/login");
            });
        }
    }, [
        isAuthed,
        isAuthLoading,
        user,
        profileStatus,
        profileError,
        logout,
        router,
    ]);

    // Redirect if profile already complete
    useEffect(() => {
        if (!isAuthLoading && isProfileReady) {
            clearProfileSetupState();
            router.replace("/");
        }
    }, [isAuthLoading, isProfileReady, router]);

    // Pre-fill username if exists
    useEffect(() => {
        if (user?.username) {
            setUsername(user.username);
        }
        if (user?.avatar_urls?.md) {
            setAvatarPreview(user.avatar_urls.md);
        }
    }, [user]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validTypes.includes(file.type)) {
            setError("请选择 JPEG、PNG 或 WEBP 格式的图片！");
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setError("图片大小不能超过 5MB！");
            return;
        }

        setError("");
        setCropperFile(file); // Trigger cropper

        // Reset file input
        e.target.value = "";
    };

    const handleCropConfirm = (croppedBlob: Blob) => {
        setCropperFile(null);

        // Convert blob to file
        const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
        setAvatarFile(file);

        // Preview
        setAvatarPreview(URL.createObjectURL(croppedBlob));
    };

    const handleCropCancel = () => {
        setCropperFile(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            if (fileInputRef.current) {
                // Manually trigger check logic instead of modifying input directly
                const validTypes = ["image/jpeg", "image/png", "image/webp"];
                if (!validTypes.includes(file.type)) {
                    setError("请选择 JPEG、PNG 或 WEBP 格式的图片");
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    setError("图片大小不能超过 5MB");
                    return;
                }
                setCropperFile(file);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validate username
        if (username.length < 2 || username.length > 50) {
            setError("用户名长度需要在 2-50 字符之间！");
            return;
        }

        // Validate avatar
        if (!avatarFile && !user?.avatar_image_key) {
            setError("请上传头像");
            return;
        }

        setIsSubmitting(true);

        try {
            if (!isAuthed) {
                clearProfileSetupState();
                router.replace("/login");
                return;
            }

            let avatarImageKey = user?.avatar_image_key ?? null;

            // Upload avatar if new file selected
            if (avatarFile) {
                const uploadResult = await uploadFile(avatarFile, { kind: "user_avatar" });
                avatarImageKey = uploadResult.image_key;
            }

            // Update profile
            await updateUserProfile({
                username,
                avatar_image_key: avatarImageKey,
            });

            try {
                await refreshUser();
            } catch (err) {
                console.error("Failed to refresh user after profile update:", err);
            }

            clearProfileSetupState();
            router.replace("/");
        } catch (err) {
            const message = err instanceof Error ? err.message : "设置失败，请重试";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isAuthLoading || !isSetupAllowed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">完善您的资料</h1>
                        <p className="text-gray-500">
                            设置您的用户名和头像
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Avatar Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                头像
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                className="relative mx-auto w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors overflow-hidden group"
                            >
                                {avatarPreview ? (
                                    <>
                                        <Image
                                            src={avatarPreview}
                                            alt="Avatar preview"
                                            fill
                                            className="object-cover"
                                            unoptimized={avatarPreview.startsWith("data:")}
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

                        {/* Username Input */}
                        <div>
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                用户名
                            </label>
                            <input
                                id="username"
                                type="text"
                                required
                                minLength={2}
                                maxLength={50}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                                placeholder="输入您的用户名"
                                disabled={isSubmitting}
                            />
                            <p className="text-xs text-gray-400 mt-1">2-50 个字符</p>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "正在保存..." : "完成设置"}
                        </button>
                    </form>
                </div>
            </div>

            {/* Cropper Modal */}
            {cropperFile && (
                <AvatarCropper
                    file={cropperFile}
                    onConfirm={handleCropConfirm}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}
