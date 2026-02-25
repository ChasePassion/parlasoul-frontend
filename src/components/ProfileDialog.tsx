"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileDialog({
    isOpen,
    onClose,
}: ProfileDialogProps) {
    const router = useRouter();
    const { logout } = useAuth();

    if (!isOpen) return null;

    const handleNavigateToProfile = () => {
        router.push("/profile");
        onClose();
    };

    const handleLogout = () => {
        logout();
        onClose();
        router.push("/login");
    };

    const handleOpenSettings = () => {
        router.push("/settings");
        onClose();
    };

    const handleOpenFavorites = () => {
        router.push("/favorites");
        onClose();
    };

    return (
        <div
            className="absolute bottom-16 left-2 w-[90%] bg-white rounded-xl shadow-xl z-50 py-2 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Personal Profile */}
            <button
                onClick={handleNavigateToProfile}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
            >
                <Image src="/me.svg" alt="Profile" width={20} height={20} className="shrink-0" />
                <span className="text-sm font-medium text-gray-700">个人资料</span>
            </button>

            <button
                onClick={handleOpenSettings}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
            >
                <Image src="/setting.svg" alt="Settings" width={20} height={20} className="shrink-0" />
                <span className="text-sm font-medium text-gray-700">设置</span>
            </button>

            <button
                onClick={handleOpenFavorites}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
            >
                <Image src="/mark.svg" alt="Favorites" width={20} height={20} className="shrink-0" />
                <span className="text-sm font-medium text-gray-700">收藏夹</span>
            </button>

            {/* Divider */}
            <div role="separator" aria-orientation="horizontal" className="bg-gray-200 h-px mx-4 my-1" />

            {/* Logout */}
            <button
                onClick={handleLogout}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
            >
                <Image src="/out.svg" alt="Logout" width={20} height={20} className="shrink-0" />
                <span className="text-sm font-medium text-gray-700">退出登录</span>
            </button>
        </div>
    );
}
