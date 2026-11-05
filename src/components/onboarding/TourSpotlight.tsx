"use client";

import { useId } from "react";

export interface SpotlightHole {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

interface TourSpotlightProps {
  hole: SpotlightHole;
  allowInteraction: boolean;
}

export default function TourSpotlight({
  hole,
  allowInteraction,
}: TourSpotlightProps) {
  const maskId = `tour-spotlight-${useId().replace(/:/g, "")}`;

  return (
    <>
      <svg
        className="pointer-events-none fixed inset-0 z-[90] h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="100%"
            height="100%"
          >
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={hole.radius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(13, 13, 13, 0.36)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {!allowInteraction && (
        <>
          <div
            className="fixed left-0 top-0 z-[89] cursor-default"
            style={{ right: 0, height: hole.y }}
            aria-hidden="true"
          />
          <div
            className="fixed left-0 z-[89] cursor-default"
            style={{ right: 0, top: hole.y + hole.height, bottom: 0 }}
            aria-hidden="true"
          />
          <div
            className="fixed left-0 z-[89] cursor-default"
            style={{
              top: hole.y,
              width: hole.x,
              height: hole.height,
            }}
            aria-hidden="true"
          />
          <div
            className="fixed z-[89] cursor-default"
            style={{
              left: hole.x + hole.width,
              right: 0,
              top: hole.y,
              height: hole.height,
            }}
            aria-hidden="true"
          />
        </>
      )}
    </>
  );
}
