"use client";

import { Overlay } from "@/convex/types";
import { useState, useRef, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";

interface OverlayPreviewProps {
  overlayUrl: string;
  overlayType: Overlay["overlayType"] | null;
  className?: string;
}

export default function OverlayPreview({
  overlayUrl,
  overlayType,
  className = "",
}: OverlayPreviewProps) {
  const [isLoading, setIsLoading] = useState(!!overlayUrl);
  const [containerSize, setContainerSize] = useState({ width: 480, height: 270 });
  const containerRef = useRef<HTMLDivElement>(null);
  const prevOverlayUrlRef = useRef(overlayUrl);

  // Synchronously detect overlay change and set loading state during render
  if (prevOverlayUrlRef.current !== overlayUrl) {
    prevOverlayUrlRef.current = overlayUrl;
    if (overlayUrl && !isLoading) {
      setIsLoading(true);
    }
  }

  // Determine original dimensions based on overlay type
  const isCardOverlay = overlayType === "card";
  const originalWidth = isCardOverlay ? 745 : 1920;
  const originalHeight = isCardOverlay ? 1040 : 1080;

  // Measure container and calculate scale
  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [updateSize]);

  // Calculate scale based on container size (fit within container maintaining 16:9)
  const scale = Math.min(
    containerSize.width / 1920,
    containerSize.height / 1080
  );

  // For card overlays, calculate scale to fit height and center horizontally
  let iframeScale = scale;
  let leftOffset = 0;

  if (isCardOverlay) {
    // Scale to fit the full height within the container
    iframeScale = (1080 * scale) / originalHeight;
    // Center horizontally
    const scaledIframeWidth = originalWidth * iframeScale;
    leftOffset = (1920 * scale - scaledIframeWidth) / 2;
  }

  return (
    <div
      ref={containerRef}
      className={`border rounded-lg overflow-hidden bg-black ${className}`}
      style={{ aspectRatio: "16/9" }}
    >
      {/* Inner container for the scaled content */}
      <div
        style={{
          width: `${1920 * scale}px`,
          height: `${1080 * scale}px`,
          position: "relative",
          overflow: "hidden",
          margin: "auto",
        }}
      >
        {!overlayUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No overlay selected</p>
          </div>
        )}
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {/* Iframe at full size, then scaled down */}
        {overlayUrl && (
          <iframe
            key={overlayUrl}
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
            title={`Preview of ${overlayUrl.split("/").pop()}`}
          />
        )}
      </div>
    </div>
  );
}
