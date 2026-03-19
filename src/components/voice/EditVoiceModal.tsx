"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchVoiceById } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-map";
import type { VoiceCardDisplay } from "@/lib/voice-adapter";

interface EditVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  voice: VoiceCardDisplay | null;
}

type FetchState = "idle" | "loading" | "success" | "error";

export default function EditVoiceModal({
  isOpen,
  onClose,
  onSuccess,
  voice,
}: EditVoiceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && voice) {
      setName(voice.displayName);
      setDescription(voice.description || "");
    }
  }, [isOpen, voice]);

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "请输入音色名称";
    }
    if (name.trim().length > 40) {
      return "音色名称不能超过40个字符";
    }
    if (description.length > 160) {
      return "描述不能超过160个字符";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!voice) return;

    setFetchState("loading");
    setError(null);

    try {
      await patchVoiceById(voice.id, {
        display_name: name.trim(),
        description: description.trim() || null,
      });
      setFetchState("success");
      onSuccess();
      onClose();
    } catch (err) {
      setFetchState("error");
      setError(getErrorMessage(err));
    }
  };

  const handleClose = () => {
    if (fetchState !== "loading") {
      setError(null);
      setFetchState("idle");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden bg-white border-none shadow-2xl">
        <DialogHeader className="flex-none flex items-center justify-between p-5 border-b border-gray-100 bg-white z-10">
          <DialogTitle className="text-xl font-bold text-gray-900">
            编辑音色
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5 custom-scrollbar">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="editVoiceName" className="text-sm font-medium text-gray-700">
              音色名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="editVoiceName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="给你的音色起个名字"
              maxLength={40}
              disabled={fetchState === "loading"}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200 [&::selection]:bg-blue-500 [&::selection]:text-white"
            />
            <p className="text-xs text-gray-500 mt-1">{name.length}/40 字符</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editVoiceDesc" className="text-sm font-medium text-gray-700">
              音色描述
            </Label>
            <Input
              id="editVoiceDesc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个音色的特点（选填）"
              maxLength={160}
              disabled={fetchState === "loading"}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200 [&::selection]:bg-blue-500 [&::selection]:text-white"
            />
            <p className="text-xs text-gray-500 mt-1">{description.length}/160 字符</p>
          </div>
        </div>

        <DialogFooter className="flex-none flex gap-3 p-5 border-t border-gray-100 bg-white z-10">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={fetchState === "loading"}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={fetchState === "loading"}
            className="flex-1 px-4 py-2.5 bg-[#3964FE] text-white rounded-lg font-medium hover:bg-[#2a4fd6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {fetchState === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
