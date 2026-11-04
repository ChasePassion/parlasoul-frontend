"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SpriteIcon } from "@/components/ui/sprite-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
}

export default function ProfileDialog({
    isOpen,
    onClose,
    onOpenSettings,
}: ProfileDialogProps) {
    const router = useRouter();
    const { logout } = useAuth();

    const handleNavigateToProfile = () => {
        router.push("/profile");
        onClose();
    };

    const handleLogout = async () => {
        try {
            await logout();
            onClose();
            router.push("/login");
        } catch (error) {
            console.error("Failed to logout:", error);
        }
    };

    const handleOpenSettings = () => {
        onOpenSettings();
        onClose();
    };

    const handleOpenFavorites = () => {
        router.push("/favorites");
        onClose();
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DropdownMenuTrigger asChild>
                <div />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side="top"
                align="start"
                className="w-[200px] p-1.5 rounded-xl shadow-xl"
                sideOffset={8}
            >
                <DropdownMenuItem
                    onClick={handleNavigateToProfile}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
                >
                    <SpriteIcon name="me" size={20} className="shrink-0" />
                    <span className="text-sm font-medium text-gray-700">个人资料</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={handleOpenSettings}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
                >
                    <SpriteIcon name="setting" size={20} className="shrink-0" />
                    <span className="text-sm font-medium text-gray-700">设置</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={handleOpenFavorites}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent"
                >
                    <SpriteIcon name="mark" size={20} className="shrink-0" />
                    <span className="text-sm font-medium text-gray-700">收藏夹</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-gray-100 h-px mx-2 my-1" />

                <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-accent text-destructive"
                >
                    <SpriteIcon name="out" size={20} className="shrink-0" />
                    <span className="text-sm font-medium">退出登录</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
