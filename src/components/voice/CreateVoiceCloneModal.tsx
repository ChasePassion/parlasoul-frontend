"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, X, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createVoiceClone } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-map";

interface CreateVoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ACCEPTED_AUDIO_FORMATS = ["audio/wav", "audio/mp3", "audio/mpeg", "audio/m4a", "audio/flac", "audio/opus"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type FetchState = "idle" | "loading" | "success" | "error";

export default function CreateVoiceCloneModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateVoiceCloneModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "请输入音色名称";
    }
    if (name.trim().length > 40) {
      return "音色名称不能超过40个字符";
    }
    if (!audioFile) {
      return "请上传音频文件";
    }
    if (description.length > 160) {
      return "描述不能超过160个字符";
    }
    return null;
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_AUDIO_FORMATS.includes(file.type)) {
      setError("不支持的音频格式，请上传 WAV、MP3、M4A、FLAC 或 OPUS 格式");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`音频文件过大，请上传小于${MAX_FILE_SIZE_MB}MB的文件`);
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    setAudioFile(file);
    setAudioPreview(URL.createObjectURL(file));
    setError(null);
  }, []);

  const handleRemoveAudio = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setAudioFile(null);
    setAudioPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!audioFile) return;

    setFetchState("loading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("display_name", name.trim());
      formData.append("source_audio", audioFile);
      formData.append("source_audio_format", getAudioFormat(audioFile.name));
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      await createVoiceClone(formData);
      setFetchState("success");
      onSuccess();
      handleClose();
    } catch (err) {
      setFetchState("error");
      setError(getErrorMessage(err));
    }
  };

  const handleClose = () => {
    if (fetchState !== "loading") {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setName("");
      setDescription("");
      setAudioFile(null);
      setAudioPreview(null);
      setError(null);
      setFetchState("idle");
      onClose();
    }
  };

  const getAudioFormat = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const formatMap: Record<string, string> = {
      wav: "wav",
      mp3: "mp3",
      m4a: "m4a",
      flac: "flac",
      opus: "opus",
    };
    return formatMap[ext || ""] || "wav";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden bg-white border-none shadow-2xl">
        <DialogHeader className="flex-none flex items-center justify-between p-5 border-b border-gray-100 bg-white z-10">
          <DialogTitle className="text-xl font-bold text-gray-900">
            克隆音色
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
            <Label htmlFor="voiceName" className="text-sm font-medium text-gray-700">
              音色名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="voiceName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="给你的音色起个名字"
              maxLength={40}
              disabled={fetchState === "loading"}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200"
            />
            <p className="text-xs text-gray-500 mt-1">{name.length}/40 字符</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voiceDesc" className="text-sm font-medium text-gray-700">
              音色描述
            </Label>
            <Input
              id="voiceDesc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个音色的特点（选填）"
              maxLength={160}
              disabled={fetchState === "loading"}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200"
            />
            <p className="text-xs text-gray-500 mt-1">{description.length}/160 字符</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              音频样本 <span className="text-red-500">*</span>
            </Label>

            {audioPreview ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 truncate">
                    {audioFile?.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {(audioFile!.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAudio}
                  disabled={fetchState === "loading"}
                  className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">点击上传音频文件</p>
                <p className="text-xs text-gray-400 mt-1">
                  支持 WAV、MP3、M4A、FLAC、OPUS 格式，最大 {MAX_FILE_SIZE_MB}MB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/wav,audio/mp3,audio/mpeg,audio/m4a,audio/flac,audio/opus"
              onChange={handleFileSelect}
              className="hidden"
            />
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
                创建中...
              </>
            ) : (
              "创建音色"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
