"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface AvatarCropperProps {
    file: File;
    onConfirm: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Bounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

const MIN_CROP_SIZE = 20;
const MIN_IMAGE_SCALE = 0.25;
const MAX_IMAGE_SCALE = 4;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function toBounds(left: number, top: number, width: number, height: number): Bounds {
    return {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
    };
}

function intersectBounds(a: Bounds, b: Bounds): Bounds | null {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);

    if (right <= left || bottom <= top) {
        return null;
    }

    return toBounds(left, top, right - left, bottom - top);
}

export default function AvatarCropper({ file, onConfirm, onCancel }: AvatarCropperProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [cropRect, setCropRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });
    const [imageScale, setImageScale] = useState(1);

    // Interaction state
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 }); // Mouse/Touch start pos
    const [startRect, setStartRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });

    useEffect(() => {
        setImageScale(1);
        setCropRect({ x: 0, y: 0, width: 0, height: 0 });

        const reader = new FileReader();
        reader.onload = (e) => {
            setImageSrc(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    }, [file]);

    const getClientPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if ("touches" in e) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };

    const getBaseImageBounds = useCallback((): Bounds | null => {
        const img = imgRef.current;
        if (!img) return null;

        return toBounds(img.offsetLeft, img.offsetTop, img.clientWidth, img.clientHeight);
    }, []);

    const getContainerBounds = useCallback((): Bounds | null => {
        const container = containerRef.current;
        if (!container) return null;

        return toBounds(0, 0, container.clientWidth, container.clientHeight);
    }, []);

    const getImageBounds = useCallback((scale = imageScale): Bounds | null => {
        const baseBounds = getBaseImageBounds();
        if (!baseBounds) return null;

        const centerX = baseBounds.left + baseBounds.width / 2;
        const centerY = baseBounds.top + baseBounds.height / 2;
        const width = baseBounds.width * scale;
        const height = baseBounds.height * scale;

        return toBounds(centerX - width / 2, centerY - height / 2, width, height);
    }, [getBaseImageBounds, imageScale]);

    const getCropConstraintBounds = useCallback((scale = imageScale): Bounds | null => {
        const imageBounds = getImageBounds(scale);
        const containerBounds = getContainerBounds();
        if (!imageBounds || !containerBounds) return null;

        return intersectBounds(imageBounds, containerBounds);
    }, [getContainerBounds, getImageBounds, imageScale]);

    const getMinScaleForCrop = useCallback((rect: Rect): number => {
        const baseBounds = getBaseImageBounds();
        if (!baseBounds || rect.width === 0 || rect.height === 0) {
            return MIN_IMAGE_SCALE;
        }

        const centerX = baseBounds.left + baseBounds.width / 2;
        const centerY = baseBounds.top + baseBounds.height / 2;
        const cropRight = rect.x + rect.width;
        const cropBottom = rect.y + rect.height;

        return clamp(
            Math.max(
                (2 * (centerX - rect.x)) / baseBounds.width,
                (2 * (cropRight - centerX)) / baseBounds.width,
                (2 * (centerY - rect.y)) / baseBounds.height,
                (2 * (cropBottom - centerY)) / baseBounds.height,
                MIN_IMAGE_SCALE
            ),
            MIN_IMAGE_SCALE,
            MAX_IMAGE_SCALE
        );
    }, [getBaseImageBounds]);

    // Initialize crop rect inside the visible image area.
    const handleImageLoad = () => {
        const bounds = getCropConstraintBounds(1);
        if (!bounds) return;

        const size = Math.min(bounds.width, bounds.height) * 0.8;
        setCropRect({
            x: bounds.left + (bounds.width - size) / 2,
            y: bounds.top + (bounds.height - size) / 2,
            width: size,
            height: size,
        });
    };

    const handlePointerDown = (
        e: React.MouseEvent | React.TouchEvent,
        type: "move" | "nw" | "ne" | "sw" | "se"
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragType(type);
        setStartPos(getClientPos(e.nativeEvent as MouseEvent | TouchEvent)); // React Type casting
        setStartRect(cropRect);
    };

    const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging || !dragType) return;

        const bounds = getCropConstraintBounds();
        if (!bounds) return;

        const currentPos = getClientPos(e);
        const deltaX = currentPos.x - startPos.x;
        const deltaY = currentPos.y - startPos.y;

        const newRect = { ...startRect };

        if (dragType === "move") {
            newRect.x = clamp(startRect.x + deltaX, bounds.left, bounds.right - newRect.width);
            newRect.y = clamp(startRect.y + deltaY, bounds.top, bounds.bottom - newRect.height);
        } else {
            // Resize logic keeping aspect ratio 1:1
            // This is simplified, usually implies complex math for each corner
            // For 1:1, width change must equal height change

            // Simplified approach: Just regular resize, then enforce square? 
            // Better: Enforce 1:1 during delta calculation

            if (dragType === "se") {
                // Bottom-right
                const maxD = Math.min(bounds.right - startRect.x, bounds.bottom - startRect.y) - startRect.width;
                // We want delta to be uniform
                const d = clamp(Math.max(deltaX, deltaY), MIN_CROP_SIZE - startRect.width, maxD);
                newRect.width = startRect.width + d;
                newRect.height = startRect.height + d;
            } else if (dragType === "sw") {
                // Bottom-left: x changes, width changes, y constant, height changes
                // width change = -deltaX
                // height change = width change (to keep square)
                // Constraint: x >= 0, width >= 20, y+height <= imgHeight

                // Let's use a simpler clamp approach
                // Calculate potential new width based on mouse x
                const newW = clamp(startRect.width - deltaX, MIN_CROP_SIZE, startRect.x + startRect.width - bounds.left);
                // Ensure it fits vertically
                const clampedW = Math.min(newW, bounds.bottom - startRect.y);

                newRect.x = startRect.x + startRect.width - clampedW;
                newRect.width = clampedW;
                newRect.height = clampedW;
            } else if (dragType === "ne") {
                // Top-right: y changes, height changes, x constant, width changes
                const newW = clamp(startRect.width + deltaX, MIN_CROP_SIZE, bounds.right - startRect.x);
                const clampedW = Math.min(newW, startRect.y + startRect.height - bounds.top);

                newRect.y = startRect.y + startRect.height - clampedW;
                newRect.width = clampedW;
                newRect.height = clampedW;
            } else if (dragType === "nw") {
                // Top-left
                const newW = clamp(startRect.width - deltaX, MIN_CROP_SIZE, startRect.x + startRect.width - bounds.left);
                const clampedW = Math.min(newW, startRect.y + startRect.height - bounds.top);

                newRect.x = startRect.x + startRect.width - clampedW;
                newRect.y = startRect.y + startRect.height - clampedW;
                newRect.width = clampedW;
                newRect.height = clampedW;
            }
        }

        setCropRect(newRect);
    }, [dragType, getCropConstraintBounds, isDragging, startPos, startRect]);

    const handlePointerUp = useCallback(() => {
        setIsDragging(false);
        setDragType(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handlePointerMove);
            window.addEventListener("touchmove", handlePointerMove);
            window.addEventListener("mouseup", handlePointerUp);
            window.addEventListener("touchend", handlePointerUp);
        }
        return () => {
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("touchmove", handlePointerMove);
            window.removeEventListener("mouseup", handlePointerUp);
            window.removeEventListener("touchend", handlePointerUp);
        };
    }, [isDragging, handlePointerMove, handlePointerUp]);

    const handleConfirm = () => {
        if (!imgRef.current) return;

        const imageBounds = getImageBounds();
        if (!imageBounds) return;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const naturalWidth = imgRef.current.naturalWidth;
        const naturalHeight = imgRef.current.naturalHeight;
        const realX = clamp(((cropRect.x - imageBounds.left) / imageBounds.width) * naturalWidth, 0, naturalWidth);
        const realY = clamp(((cropRect.y - imageBounds.top) / imageBounds.height) * naturalHeight, 0, naturalHeight);
        const realW = clamp((cropRect.width / imageBounds.width) * naturalWidth, 0, naturalWidth - realX);
        const realH = clamp((cropRect.height / imageBounds.height) * naturalHeight, 0, naturalHeight - realY);

        canvas.width = 400; // Output size
        canvas.height = 400;

        ctx.drawImage(
            imgRef.current,
            realX, realY, realW, realH,
            0, 0, 400, 400
        );

        canvas.toBlob((blob) => {
            if (blob) {
                onConfirm(blob);
            }
        }, "image/jpeg", 0.9);
    };

    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (!imgRef.current || cropRect.width === 0 || cropRect.height === 0) return;

        e.preventDefault();
        const deltaY = e.deltaY;

        setImageScale((currentScale) => {
            const zoomFactor = Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
            let nextScale = clamp(currentScale * zoomFactor, MIN_IMAGE_SCALE, MAX_IMAGE_SCALE);

            if (nextScale < currentScale) {
                nextScale = Math.max(nextScale, getMinScaleForCrop(cropRect));
            }

            return Math.abs(nextScale - currentScale) < 0.0001 ? currentScale : nextScale;
        });
    }, [cropRect, getMinScaleForCrop]);

    if (!imageSrc) return null;

    return (
        <Dialog open onOpenChange={(open) => !open && onCancel()}>
            <DialogContent
                showCloseButton={false}
                onPointerDownOutside={(e) => e.preventDefault()}
                className="z-[70] max-w-2xl rounded-2xl p-0 overflow-hidden bg-white border-none shadow-2xl max-h-[90vh] flex flex-col gap-0"
            >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                    <DialogTitle className="text-lg font-bold text-gray-900">调整头像</DialogTitle>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div
                    ref={containerRef}
                    className="flex-1 overflow-hidden bg-gray-900 relative flex items-center justify-center select-none"
                    style={{ minHeight: "300px", touchAction: "none" }}
                    onWheel={handleWheel}
                >
                    {/* Native img is required for direct canvas cropping and pointer calculations. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Crop target"
                        className="max-w-full max-h-[60vh] object-contain pointer-events-none"
                        onLoad={handleImageLoad}
                        style={{
                            transform: imageScale === 1 ? "none" : `scale(${imageScale})`,
                            transformOrigin: "center center",
                        }}
                    />

                    {/* Dark overlay outside crop area */}
                    {/* We can't easily do a pure css overlay with a hole in the middle for dynamic size without complex clip-path or 4 divs.
                        Use 4 divs approach for simplicity over the image container
                     */}

                    {cropRect.width > 0 && cropRect.height > 0 && (
                        <>
                            {/* Single overlay with rounded cutout using box-shadow */}
                            <div
                                className="absolute border-2 border-white cursor-move rounded-lg overflow-hidden pointer-events-none"
                                style={{
                                    left: cropRect.x,
                                    top: cropRect.y,
                                    width: cropRect.width,
                                    height: cropRect.height,
                                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                }}
                            />

                            {/* Crop Box - Interactive layer */}
                            <div
                                className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move rounded-lg overflow-hidden"
                                style={{
                                    left: cropRect.x,
                                    top: cropRect.y,
                                    width: cropRect.width,
                                    height: cropRect.height,
                                }}
                                onMouseDown={(e) => handlePointerDown(e, "move")}
                                onTouchStart={(e) => handlePointerDown(e, "move")}
                            >
                                {/* Grid lines (optional aesthetic) */}
                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                                    <div className="border-r border-white/50 h-full col-start-2" />
                                    <div className="border-r border-white/50 h-full col-start-3" />
                                    <div className="border-b border-white/50 w-full row-start-2 col-span-3 absolute top-1/3" />
                                    <div className="border-b border-white/50 w-full row-start-3 col-span-3 absolute top-2/3" />
                                </div>

                                {/* Drag Handles */}
                                <div
                                    className="absolute -top-2 -left-2 w-5 h-5 border-t-4 border-l-4 border-white cursor-nw-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "nw")}
                                    onTouchStart={(e) => handlePointerDown(e, "nw")}
                                />
                                <div
                                    className="absolute -top-2 -right-2 w-5 h-5 border-t-4 border-r-4 border-white cursor-ne-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "ne")}
                                    onTouchStart={(e) => handlePointerDown(e, "ne")}
                                />
                                <div
                                    className="absolute -bottom-2 -left-2 w-5 h-5 border-b-4 border-l-4 border-white cursor-sw-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "sw")}
                                    onTouchStart={(e) => handlePointerDown(e, "sw")}
                                />
                                <div
                                    className="absolute -bottom-2 -right-2 w-5 h-5 border-b-4 border-r-4 border-white cursor-se-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "se")}
                                    onTouchStart={(e) => handlePointerDown(e, "se")}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white z-10">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 rounded-xl bg-[#3964FE] text-white font-medium hover:bg-[#2a4fd6] transition-colors"
                    >
                        确认使用
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
