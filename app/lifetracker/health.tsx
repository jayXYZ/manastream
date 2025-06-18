"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLifeTrackerStore } from "./store";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export default function Health(props: { index: "1" | "2" }) {
  const [playerLife, setPlayerLife] = useState<number | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [showGameReset, setShowGameReset] = useState(false);
  const [pendingOpacity, setPendingOpacity] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const opacityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutStartRef = useRef<number>(0);

  const connectedOverlayId = useLifeTrackerStore(
    (state) => state.connectedOverlayId,
  );
  if (!connectedOverlayId) {
    // App should be displaying Admin Settings if no connected overlay is set
  }

  const data = useQuery(api.overlays.getOverlayById, {
    overlayId: connectedOverlayId as Id<"overlays">,
  });

  // Specialized mutations for specific operations
  const updatePlayerLife = useMutation(api.overlays.updatePlayerLife);
  const incrementGamesWon = useMutation(api.overlays.incrementGamesWon);
  const resetMatch = useMutation(api.overlays.resetMatch);

  // Initialize local state when server data loads
  useEffect(() => {
    if (data?.overlayType === "match" && playerLife === undefined) {
      setPlayerLife(data[`player${props.index}Life`]);
    }
  }, [data, props.index, playerLife]);

  // Start the opacity fade animation
  const startOpacityFade = useCallback(() => {
    // Clear any existing opacity interval
    if (opacityIntervalRef.current) {
      clearInterval(opacityIntervalRef.current);
    }

    // Set to full opacity and record start time
    setPendingOpacity(1);
    timeoutStartRef.current = Date.now();

    // Update opacity every 50ms
    opacityIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - timeoutStartRef.current;
      const remaining = Math.max(0, 2000 - elapsed);
      const opacity = remaining / 2000;

      setPendingOpacity(opacity);

      if (opacity <= 0) {
        clearInterval(opacityIntervalRef.current!);
        opacityIntervalRef.current = null;
      }
    }, 50);
  }, []);

  // Debounced function to update the server
  const debouncedUpdateLife = useCallback(
    (newLifeTotal: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Start the fade animation
      startOpacityFade();

      timeoutRef.current = setTimeout(() => {
        if (connectedOverlayId) {
          updatePlayerLife({
            overlayId: connectedOverlayId as Id<"overlays">,
            playerIndex: props.index,
            newLifeTotal,
          });
        }
      }, 2000); // Wait 2000ms after last change
    },
    [connectedOverlayId, props.index, updatePlayerLife, startOpacityFade],
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (opacityIntervalRef.current) {
        clearInterval(opacityIntervalRef.current);
      }
    };
  }, []);

  const handleGameReset = (currentPlayerWon: boolean) => {
    if (!connectedOverlayId) return;

    if (currentPlayerWon) {
      incrementGamesWon({
        overlayId: connectedOverlayId as Id<"overlays">,
        playerIndex: props.index,
      });
      setPlayerLife(20);
    } else {
      // Increment the other player's games won
      const otherPlayerIndex = props.index === "1" ? "2" : "1";
      incrementGamesWon({
        overlayId: connectedOverlayId as Id<"overlays">,
        playerIndex: otherPlayerIndex,
      });
      setPlayerLife(20);
    }

    setShowGameReset(false);
    setShowSettings(false);
  };

  const handleLifeChange = (newLifeTotal: number) => {
    // Update local state immediately for responsive UI
    setPlayerLife(newLifeTotal);
    // Debounce the server update
    debouncedUpdateLife(newLifeTotal);
  };

  const handleMatchReset = () => {
    if (!connectedOverlayId) return;

    resetMatch({
      overlayId: connectedOverlayId as Id<"overlays">,
    });
    setPlayerLife(20);
  };

  if (!data) {
    // display loading spinner
    return;
  }

  if (data.overlayType !== "match") {
    // throw error, this should never happen
    return;
  }

  // Show loading if we don't have local state yet
  if (playerLife === undefined) {
    return <div>Loading...</div>;
  }

  const difference = playerLife - data[`player${props.index}Life`];

  return (
    <div
      className={`relative h-screen w-full flex flex-col items-center justify-center font-mono ${
        props.index === "1" ? "bg-[#D08182]" : "bg-[#78B2D3] rotate-180"
      }`}
    >
      {/* Buttons */}
      <Button
        variant="ghost"
        className="absolute inset-y-0 right-0 h-full w-1/2 touch-manipulation"
        onClick={() => handleLifeChange(playerLife + 1)}
      />
      <Button
        variant="ghost"
        className="absolute inset-y-0 left-0 h-full w-1/2 touch-manipulation"
        onClick={() => handleLifeChange(playerLife - 1)}
      />
      {/* Game won indicator */}
      <div className="absolute left-4 top-4 flex">
        Games Won:
        <span className="flex flex-row items-center gap-2 px-1">
          <div
            className={`size-4 rounded-full border-2 border-white ${
              data[`player${props.index}GamesWon`] !== null &&
              data[`player${props.index}GamesWon`] >= 1
                ? "bg-white"
                : ""
            }`}
          />
          <div
            className={`size-4 rounded-full border-2 border-white ${
              data[`player${props.index}GamesWon`] !== null &&
              data[`player${props.index}GamesWon`] >= 2
                ? "bg-white"
                : ""
            }`}
          />
        </span>
      </div>
      {/* Life total */}
      <div className="flex flex-row items-center gap-4">
        <div className="cursor-pointer touch-manipulation select-none text-[8vmin] font-bold">
          -
        </div>
        <div className="touch-manipulation select-none text-[32vmin] font-bold text-white">
          {playerLife}
        </div>
        <div className="cursor-pointer touch-manipulation select-none text-[8vmin] font-bold">
          +
        </div>
      </div>
      {/* Difference */}
      {difference !== 0 && (
        <div
          style={{
            opacity: pendingOpacity,
            transition: "opacity 0.1s ease-out",
          }}
          className="absolute text-white text-4xl font-bold text-center top-12 mx-auto bg-gray-400 rounded-full w-[20vmin] h-[10vmin] flex items-center justify-center"
        >
          {difference > 0 ? "+" : ""}
          {difference}
        </div>
      )}
      {/* Player Name */}
      <div className="absolute bottom-[10vmin] text-white text-2xl font-bold text-center">
        {data[`player${props.index}DisplayName`] ||
          data[`player${props.index}Data`]?.name}
      </div>
    </div>
  );
}
