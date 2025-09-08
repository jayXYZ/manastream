"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLifeTrackerStore } from "./store";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  RotateCcwIcon,
  XIcon,
  ArrowDownUpIcon,
} from "lucide-react";

export default function Health(props: { index: "1" | "2" }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showGameReset, setShowGameReset] = useState(false);
  const [showSwapPlayers, setShowSwapPlayers] = useState(false);
  const [pendingOpacity, setPendingOpacity] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const opacityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutStartRef = useRef<number>(0);

  const connectedOverlayId = useLifeTrackerStore(
    (state) => state.connectedOverlayId,
  );
  const playerLife = useLifeTrackerStore(
    (state) => state[`player${props.index}Life`],
  );
  const setPlayerLife = useLifeTrackerStore((state) => state.setPlayerLife);
  const resetBothPlayers = useLifeTrackerStore(
    (state) => state.resetBothPlayers,
  );
  const setShowAdminSettings = useLifeTrackerStore(
    (state) => state.setShowAdminSettings,
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
  const swapPlayers = useMutation(api.overlays.swapPlayers);

  // Initialize local state when server data loads
  useEffect(() => {
    if (data?.overlayType === "match" && playerLife === null) {
      setPlayerLife(props.index, data[`player${props.index}Life`]);
    }
  }, [data, props.index, playerLife, setPlayerLife]);

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
    } else {
      // Increment the other player's games won
      const otherPlayerIndex = props.index === "1" ? "2" : "1";
      incrementGamesWon({
        overlayId: connectedOverlayId as Id<"overlays">,
        playerIndex: otherPlayerIndex,
      });
    }

    // Reset both players' life totals immediately in local state
    resetBothPlayers();

    setShowGameReset(false);
    setShowSettings(false);
  };

  const handleLifeChange = (newLifeTotal: number) => {
    // Update local state immediately for responsive UI
    setPlayerLife(props.index, newLifeTotal);
    // Debounce the server update
    debouncedUpdateLife(newLifeTotal);
  };

  const handleSwapPlayers = () => {
    if (!connectedOverlayId) return;
    swapPlayers({
      overlayId: connectedOverlayId as Id<"overlays">,
    });
    setShowSwapPlayers(false);
  };

  const swapEnabled =
    data?.overlayType === "match" &&
    data.player1GamesWon === 0 &&
    data.player2GamesWon === 0 &&
    data.player1Life === 20 &&
    data.player2Life === 20;

  if (!data) {
    // display loading spinner
    return;
  }

  if (data.overlayType !== "match") {
    // throw error, this should never happen
    return;
  }

  // Show loading if we don't have local state yet
  if (playerLife === null) {
    return <div>Loading...</div>;
  }

  const difference = playerLife - data[`player${props.index}Life`];

  return (
    <div
      className={`relative h-full w-full flex flex-col items-center justify-center font-mono ${
        props.index === "1" ? "bg-[#D08182]" : "bg-[#78B2D3] rotate-180"
      }`}
    >
      {/* Settings button */}
      {!showSettings && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            className="size-20"
            onClick={() => setShowSettings(true)}
          >
            <SettingsIcon className="size-16" />
          </Button>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="absolute top-0 left-0 w-full h-full bg-black/80 z-50">
          <div className="absolute top-4 right-4 z-100">
            <Button
              variant="ghost"
              className="size-20"
              onClick={() => setShowSettings(false)}
            >
              <XIcon className="size-16" />
            </Button>
          </div>
          <div className="flex flex-row items-center justify-center w-1/2 h-full mx-auto">
            <div className="w-full h-full flex flex-col items-center justify-center gap-8">
              <Button
                variant="ghost"
                className="w-32 h-32 flex flex-col items-center justify-center"
                onClick={() => setShowGameReset(true)}
              >
                <RotateCcwIcon className="size-16 stroke-3 stroke-red-500" />
                <span className="text-sm font-bold">Reset Game</span>
              </Button>
            </div>
            <div className="w-full h-full flex flex-col items-center justify-center gap-8">
              <Button
                disabled={!swapEnabled}
                variant="ghost"
                className="w-32 h-32 flex flex-col items-center justify-center"
                onClick={() => setShowSwapPlayers(true)}
              >
                <ArrowDownUpIcon className="size-16 stroke-3 stroke-yellow-500" />
                <span className="text-sm font-bold">Swap Players</span>
              </Button>
            </div>

            {/* Admin buttons - positioned at bottom and styled to be less prominent */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs opacity-60 hover:opacity-100 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                onClick={() => setShowAdminSettings(true)}
              >
                Admin Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Game Reset */}
      {showGameReset && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="relative bg-background rounded-lg border p-6 shadow-lg max-w-sm w-full mx-4">
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                className="size-10"
                onClick={() => setShowGameReset(false)}
              >
                <XIcon className="size-8" />
              </Button>
            </div>
            <div className="flex flex-col gap-2 text-center">
              <h2 className="text-lg leading-none font-semibold">Reset Game</h2>
              <p className="text-muted-foreground text-sm">
                Did you lose or winthis game?
              </p>
            </div>
            <div className="w-2/3 mx-auto flex flex-row gap-2 justify-between mt-4">
              <Button
                className="bg-red-500 font-bold"
                onClick={() => handleGameReset(false)}
              >
                I lost!
              </Button>
              <Button
                className="bg-green-500 font-bold"
                onClick={() => handleGameReset(true)}
              >
                I won!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Players */}
      {showSwapPlayers && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="relative bg-background rounded-lg border p-6 shadow-lg max-w-sm w-full mx-4">
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                className="size-10"
                onClick={() => setShowSwapPlayers(false)}
              >
                <XIcon className="size-8" />
              </Button>
            </div>
            <div className="flex flex-col gap-2 text-center">
              <h2 className="text-lg leading-none font-semibold">
                Swap Players
              </h2>
              <p className="text-muted-foreground text-sm">
                Swap seats with the other player.
              </p>
            </div>
            <div className="w-full flex mx-auto items-center justify-center mt-4">
              <Button
                className="bg-green-500 font-bold"
                onClick={() => handleSwapPlayers()}
              >
                Swap
              </Button>
            </div>
          </div>
        </div>
      )}

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
