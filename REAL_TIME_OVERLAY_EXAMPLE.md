# Real-time Overlay Example for OBS

## The Perfect Setup: Next.js Page with Convex Real-time Subscriptions

Since you're providing **styled overlays for OBS browser sources**, you want the Next.js page approach with full real-time updates. Here's how to build it:

## 1. Real-time Match Overlay Component

```typescript
// components/MatchOverlay.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface MatchOverlayProps {
  publicUuid: string;
}

export function MatchOverlay({ publicUuid }: MatchOverlayProps) {
  // 🔥 Real-time subscription! Updates automatically when data changes
  const overlay = useQuery(api.overlays.getOverlayByUuid, {
    publicUuid,
  });

  if (!overlay || overlay.overlayType !== "match") {
    return (
      <div className="overlay-error">
        <h1>Match not found</h1>
      </div>
    );
  }

  return (
    <div className="match-overlay">
      {/* Custom styling for OBS */}
      <style jsx>{`
        .match-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: transparent;
          font-family: 'Arial', sans-serif;
          color: white;
          pointer-events: none; /* Important for OBS overlays */
        }

        .player-life {
          position: absolute;
          font-size: 48px;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        }

        .player1-life {
          top: 50px;
          left: 50px;
          color: #ff6b6b;
        }

        .player2-life {
          top: 50px;
          right: 50px;
          color: #4ecdc4;
        }

        .games-won {
          position: absolute;
          font-size: 24px;
          top: 120px;
        }

        .player1-games {
          left: 50px;
        }

        .player2-games {
          right: 50px;
        }

        .match-info {
          position: absolute;
          bottom: 50px;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          background: rgba(0, 0, 0, 0.7);
          padding: 10px 20px;
          border-radius: 8px;
        }
      `}</style>

      {/* Player 1 Life Total */}
      <div className="player-life player1-life">
        {overlay.player1Life}
      </div>

      {/* Player 2 Life Total */}
      <div className="player-life player2-life">
        {overlay.player2Life}
      </div>

      {/* Games Won */}
      <div className="games-won player1-games">
        Games: {overlay.player1GamesWon}
      </div>

      <div className="games-won player2-games">
        Games: {overlay.player2GamesWon}
      </div>

      {/* Match Info */}
      <div className="match-info">
        <div>Round {overlay.roundNumber || 1}</div>
        {overlay.player1DisplayName && overlay.player2DisplayName && (
          <div>
            {overlay.player1DisplayName} vs {overlay.player2DisplayName}
          </div>
        )}
      </div>
    </div>
  );
}
```

## 2. Public Overlay Page (OBS Entry Point)

```typescript
// app/overlay/[uuid]/page.tsx
import { MatchOverlay } from "@/components/MatchOverlay";
import { CardOverlay } from "@/components/CardOverlay";
import { StandingsOverlay } from "@/components/StandingsOverlay";
import { api } from "@/convex/_generated/api";
import { preloadQuery } from "convex/nextjs";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

interface Props {
  params: { uuid: string };
}

export default async function PublicOverlayPage({ params }: Props) {
  // Server-side preload for faster initial render
  const preloadedOverlay = await preloadQuery(api.overlays.getOverlayByUuid, {
    publicUuid: params.uuid,
  });

  return (
    <ConvexClientProvider>
      <div className="overlay-container">
        <OverlayRenderer
          uuid={params.uuid}
          preloadedOverlay={preloadedOverlay}
        />
      </div>
    </ConvexClientProvider>
  );
}

function OverlayRenderer({
  uuid,
  preloadedOverlay
}: {
  uuid: string;
  preloadedOverlay: any;
}) {
  // This will use the preloaded data initially, then switch to real-time
  if (!preloadedOverlay) {
    return (
      <div className="overlay-error">
        <h1>Overlay not found</h1>
      </div>
    );
  }

  // Route to appropriate overlay component based on type
  switch (preloadedOverlay.overlayType) {
    case "match":
      return <MatchOverlay publicUuid={uuid} />;
    case "card":
      return <CardOverlay publicUuid={uuid} />;
    case "standings":
      return <StandingsOverlay publicUuid={uuid} />;
    default:
      return <div>Unknown overlay type</div>;
  }
}

// OBS-friendly metadata
export async function generateMetadata({ params }: Props) {
  return {
    title: `Overlay ${params.uuid}`,
    description: "Live tournament overlay",
    // Important for OBS browser sources
    viewport: "width=device-width, initial-scale=1, user-scalable=no",
  };
}
```

## 3. ConvexClientProvider for Real-time

```typescript
// components/ConvexClientProvider.tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

## 4. How OBS Uses This

### OBS Browser Source Setup:

1. **URL**: `https://your-domain.com/overlay/abc123def456`
2. **Width**: `1920` (or your stream resolution)
3. **Height**: `1080`
4. **FPS**: `60` (for smooth updates)
5. **✅ Shutdown source when not visible**: Checked
6. **✅ Refresh browser when scene becomes active**: Checked

### What Happens:

1. **OBS loads your Next.js page** (not just JSON!)
2. **Page renders with your custom CSS styling**
3. **Convex subscription starts** → Real-time updates begin
4. **When tournament data changes** → Overlay updates instantly in OBS
5. **No polling, no manual refreshing needed!**

## 5. Real-time Benefits

### ⚡ **Instant Updates**

```typescript
// When someone updates life totals in your admin interface:
await ctx.db.patch(overlayId, {
  player1Life: 18, // Changed from 20
  player2Life: 20,
});

// OBS overlay updates INSTANTLY - no delay!
```

### 🔄 **Automatic Sync**

- **Admin updates player names** → OBS overlay shows new names immediately
- **Life totals change** → Numbers update in real-time
- **Game ends, new game starts** → Scores reset automatically
- **Round advances** → Round number updates live

### 🎨 **Full Styling Control**

- **Custom fonts, colors, animations**
- **Responsive positioning for different stream layouts**
- **Transparent backgrounds for clean overlays**
- **CSS animations for smooth transitions**

## 6. Short UUID Benefits

With 12-character UUIDs:

- **Before**: `https://your-domain.com/overlay/550e8400-e29b-41d4-a716-446655440000`
- **After**: `https://your-domain.com/overlay/abc123def456`

**Much cleaner for:**

- ✅ Sharing links with tournament organizers
- ✅ Manually typing URLs in OBS
- ✅ Easier to remember and reference
- ✅ Still plenty of collision resistance for niche app

## Summary

This approach gives you:

- ✅ **Real-time updates** (Convex's killer feature!)
- ✅ **Full styling control** (your CSS, not generic JSON)
- ✅ **OBS-ready browser sources**
- ✅ **Shorter, cleaner URLs**
- ✅ **No polling or manual refreshing needed**

The HTTP API route becomes optional - mainly useful for external integrations that specifically need raw JSON data rather than styled overlays.
