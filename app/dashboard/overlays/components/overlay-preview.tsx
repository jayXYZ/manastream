"use client";

import { Overlay } from "@/convex/types";
import { useState, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";

interface OverlayPreviewProps {
  overlay: Overlay | null;
  scale?: number; // Default 0.25 (25% of original size for standard overlays)
}

export default function OverlayPreview({
  overlay,
  scale = 0.25,
}: OverlayPreviewProps) {
  const [isLoading, setIsLoading] = useState(!!overlay);
  const prevOverlayIdRef = useRef(overlay?._id);

  // Synchronously detect overlay change and set loading state during render
  // This prevents the flash by updating state before the render completes
  if (prevOverlayIdRef.current !== overlay?._id) {
    prevOverlayIdRef.current = overlay?._id;
    if (overlay && !isLoading) {
      setIsLoading(true);
    }
  }

  // Determine original dimensions based on overlay type
  const isCardOverlay = overlay?.overlayType === "card";
  const originalWidth = isCardOverlay ? 745 : 1920;
  const originalHeight = isCardOverlay ? 1040 : 1080;

  // Container always maintains 16:9 aspect ratio (1920x1080 scaled down)
  const containerWidth = 1920 * scale;
  const containerHeight = 1080 * scale;

  // For card overlays, calculate scale to fit height and center horizontally
  let iframeScale = scale;
  let leftOffset = 0;

  if (isCardOverlay) {
    // Scale to fit the full height within the container
    iframeScale = containerHeight / originalHeight;
    // Center horizontally
    const scaledIframeWidth = originalWidth * iframeScale;
    leftOffset = (containerWidth - scaledIframeWidth) / 2;
  }

  const overlayUrl = `/overlay/${overlay?.publicUuid}`;

  return (
    <div className="border rounded-lg overflow-hidden bg-black flex-shrink-0">
      {/* Container sized to maintain 16:9 aspect ratio */}
      <div
        style={{
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {!overlay && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p>No overlay selected</p>
          </div>
        )}
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {/* Iframe at full size, then scaled down */}
        {overlay && (
          <iframe
            key={overlay?._id} // Force remount on overlay change
            src={overlayUrl}
            onLoad={() => setIsLoading(false)}
            style={{
              width: `${originalWidth}px`,
              height: `${originalHeight}px`,
              border: "none",
              transform: `scale(${iframeScale})`,
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: `${leftOffset}px`,
              pointerEvents: "none",
              opacity: isLoading ? 0 : 1,
              transition: "opacity 0.2s ease-in-out",
            }}
            title={`Preview of ${overlay?.name}`}
          />
        )}
      </div>
    </div>
  );
}
