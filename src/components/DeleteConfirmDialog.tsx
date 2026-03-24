"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
    isOpen: boolean;
    entityName: string;
    entityLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting?: boolean;
}

export default function DeleteConfirmDialog({
    isOpen,
    entityName,
    entityLabel = "角色",
    onConfirm,
    onCancel,
    isDeleting = false,
}: DeleteConfirmDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <AlertDialogContent className="max-w-md rounded-2xl p-6">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-gray-900">
                        确认删除
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-600">
                        确定要删除{entityLabel} <span className="font-semibold text-gray-900">&quot;{entityName}&quot;</span> 吗？此操作无法撤销。
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        取消
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                删除中...
                            </>
                        ) : (
                            "确认删除"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
