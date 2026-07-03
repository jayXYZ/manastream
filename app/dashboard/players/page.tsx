"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/player-table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  applyMetaBreakdownSettings,
  buildMetaBreakdown,
  getMetaBreakdownKeyCardName,
  MetaBreakdownRow,
} from "@/lib/meta-breakdown";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Download, Eye, EyeOff, SearchIcon, Settings2, X } from "lucide-react";

type MetaBreakdownDialogSettings = {
  title: string;
  filename: string;
  minMetaPercent: number;
  maxRows: number;
  decimalPlaces: number;
  includeDay2: boolean;
};

const defaultMetaBreakdownSettings: MetaBreakdownDialogSettings = {
  title: "Meta Breakdown",
  filename: "meta-breakdown",
  minMetaPercent: 0,
  maxRows: 15,
  decimalPlaces: 1,
  includeDay2: false,
};

const ELIMINATED_REGISTRATION_STATUSES = new Set([
  "DROPPED",
  "ELIMINATED",
  "DISQUALIFIED",
  "CANCELED",
  "ON_WAITLIST",
]);

export default function PlayersPage() {
  const players = useQuery(api.player.getAllTournamentPlayers);
  const tournament = useQuery(api.tournaments.getUserTournament);
  const updatePlayerInfo = useMutation(api.player.updatePlayerInfo);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showEliminated, setShowEliminated] = useState(true);
  const [isMetaBreakdownDialogOpen, setIsMetaBreakdownDialogOpen] =
    useState(false);
  const [isGeneratingMetaBreakdown, setIsGeneratingMetaBreakdown] =
    useState(false);
  const [metaBreakdownError, setMetaBreakdownError] = useState<string | null>(
    null,
  );
  const [metaBreakdownSettings, setMetaBreakdownSettings] =
    useState<MetaBreakdownDialogSettings>(defaultMetaBreakdownSettings);

  const metaBreakdownPreview = useMemo(() => {
    if (!players) {
      return null;
    }
    const breakdown = buildMetaBreakdown(
      players,
      metaBreakdownSettings.includeDay2
        ? { isDay2Player: isDay2MetaBreakdownPlayer }
        : {},
    );
    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: metaBreakdownSettings.minMetaPercent,
      maxRows: metaBreakdownSettings.maxRows,
      sortBy: metaBreakdownSettings.includeDay2
        ? "day2Percentage"
        : "day1Percentage",
    });
    return {
      totalKnownDecklists: breakdown.totalKnownDecklists,
      totalDay2KnownDecklists: breakdown.totalDay2KnownDecklists,
      rows,
    };
  }, [
    players,
    metaBreakdownSettings.minMetaPercent,
    metaBreakdownSettings.maxRows,
    metaBreakdownSettings.includeDay2,
  ]);

  const filteredPlayers = useMemo(() => {
    return players?.filter((player) => {
      const matchesSearch =
        player.name?.toLowerCase().includes(search.toLowerCase()) ||
        player.deckName?.toLowerCase().includes(search.toLowerCase()) ||
        player.deckList?.toLowerCase().includes(search.toLowerCase());
      const isEliminated = isEliminatedRegistrationStatus(
        player.registrationStatus,
      );
      return matchesSearch && (showEliminated || !isEliminated);
    });
  }, [players, search, showEliminated]);

  const handleDownloadMetaBreakdown = async () => {
    if (!players) {
      return;
    }

    setMetaBreakdownError(null);
    const breakdown = buildMetaBreakdown(
      players,
      metaBreakdownSettings.includeDay2
        ? { isDay2Player: isDay2MetaBreakdownPlayer }
        : {},
    );
    if (breakdown.totalKnownDecklists === 0) {
      setMetaBreakdownError("No players with known decklists were found.");
      return;
    }
    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: metaBreakdownSettings.minMetaPercent,
      maxRows: metaBreakdownSettings.maxRows,
      sortBy: metaBreakdownSettings.includeDay2
        ? "day2Percentage"
        : "day1Percentage",
    });
    if (rows.length === 0) {
      setMetaBreakdownError(
        "No archetypes matched the current meta breakdown settings.",
      );
      return;
    }

    setIsGeneratingMetaBreakdown(true);
    try {
      await downloadMetaBreakdownImage({
        title: metaBreakdownSettings.title,
        filename: metaBreakdownSettings.filename,
        decimalPlaces: metaBreakdownSettings.decimalPlaces,
        eventName: tournament?.eventName ?? null,
        rows,
        includeDay2Columns: metaBreakdownSettings.includeDay2,
      });
      setIsMetaBreakdownDialogOpen(false);
    } catch {
      setMetaBreakdownError("Unable to generate the meta breakdown image.");
    } finally {
      setIsGeneratingMetaBreakdown(false);
    }
  };

  return (
    <div className="rounded-xl m-8 border border-border overflow-hidden">
      <div className="rounded-t-xl border-b border-border bg-background">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <div className="items-center max-w-md">
            <InputGroup className="w-full">
              <InputGroupInput
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>

              <InputGroupAddon
                align={"inline-end"}
                className={search === "" ? "invisible" : ""}
              >
                <InputGroupButton
                  variant="outline"
                  onClick={() => setSearch("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                id="player-table-settings-menu-trigger"
                asChild
              >
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Player Table</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  role="menuitemcheckbox"
                  aria-checked={showEliminated}
                  onSelect={(event) => {
                    event.preventDefault();
                    setShowEliminated((previous) => !previous);
                  }}
                >
                  {showEliminated ? (
                    <Eye className="h-4 w-4 mr-2" />
                  ) : (
                    <EyeOff className="h-4 w-4 mr-2" />
                  )}
                  Show eliminated
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!players}
                  onSelect={() => {
                    setMetaBreakdownError(null);
                    setIsMetaBreakdownDialogOpen(true);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generate Meta Breakdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-sm text-muted-foreground">
              {filteredPlayers?.length !== players?.length
                ? `${filteredPlayers?.length}/`
                : ""}
              {players?.length} players
            </span>
          </div>
        </div>
        {metaBreakdownError ? (
          <div className="px-4 py-2 text-sm text-destructive border-b border-border">
            {metaBreakdownError}
          </div>
        ) : null}
        <Table>
          <TableHeader className="[&_tr]:border-0">
            <TableRow>
              <TableHead className="w-1/4 border-r border-border">
                Name
              </TableHead>
              <TableHead className="w-1/4 border-r border-border">
                Deck
              </TableHead>
              <TableHead className="w-1/2">Deck List</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      <Dialog
        open={isMetaBreakdownDialogOpen}
        onOpenChange={setIsMetaBreakdownDialogOpen}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Meta Breakdown</DialogTitle>
            <DialogDescription>
              Configure the output and download a static image.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="meta-breakdown-title">Image Title</Label>
              <Input
                id="meta-breakdown-title"
                value={metaBreakdownSettings.title}
                onChange={(event) =>
                  setMetaBreakdownSettings((previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
                placeholder="Meta Breakdown"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="meta-breakdown-filename">Filename</Label>
              <Input
                id="meta-breakdown-filename"
                value={metaBreakdownSettings.filename}
                onChange={(event) =>
                  setMetaBreakdownSettings((previous) => ({
                    ...previous,
                    filename: event.target.value,
                  }))
                }
                placeholder="meta-breakdown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-breakdown-min-percent">Minimum Meta %</Label>
              <Input
                id="meta-breakdown-min-percent"
                type="number"
                step={0.1}
                min={0}
                value={metaBreakdownSettings.minMetaPercent}
                onChange={(event) =>
                  setMetaBreakdownSettings((previous) => ({
                    ...previous,
                    minMetaPercent: Math.max(
                      0,
                      Number(event.target.value) || 0,
                    ),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-breakdown-max-rows">Max Archetypes</Label>
              <Input
                id="meta-breakdown-max-rows"
                type="number"
                min={1}
                value={metaBreakdownSettings.maxRows}
                onChange={(event) =>
                  setMetaBreakdownSettings((previous) => ({
                    ...previous,
                    maxRows: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-breakdown-decimals">Percent Decimals</Label>
              <Input
                id="meta-breakdown-decimals"
                type="number"
                min={0}
                max={4}
                value={metaBreakdownSettings.decimalPlaces}
                onChange={(event) =>
                  setMetaBreakdownSettings((previous) => ({
                    ...previous,
                    decimalPlaces: Math.min(
                      4,
                      Math.max(0, Number(event.target.value) || 0),
                    ),
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
              <Label
                htmlFor="meta-breakdown-day-2"
                className="text-sm font-medium"
              >
                Day 2 columns
              </Label>
              <Switch
                id="meta-breakdown-day-2"
                checked={metaBreakdownSettings.includeDay2}
                onCheckedChange={(checked) =>
                  setMetaBreakdownSettings((previous) => ({
                    ...previous,
                    includeDay2: checked,
                  }))
                }
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {metaBreakdownPreview
              ? metaBreakdownSettings.includeDay2
                ? `${metaBreakdownPreview.rows.length} archetypes from ${metaBreakdownPreview.totalKnownDecklists} day 1 players and ${metaBreakdownPreview.totalDay2KnownDecklists ?? 0} day 2 players with known decklists.`
                : `${metaBreakdownPreview.rows.length} archetypes from ${metaBreakdownPreview.totalKnownDecklists} players with known decklists.`
              : "Loading players..."}
          </div>
          {metaBreakdownError ? (
            <div className="text-sm text-destructive">{metaBreakdownError}</div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsMetaBreakdownDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDownloadMetaBreakdown}
              disabled={isGeneratingMetaBreakdown || !players}
            >
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingMetaBreakdown ? "Generating..." : "Download Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScrollArea className="h-[calc(100vh-220px)] rounded-b-xl">
        <Table>
          <TableBody>
            {filteredPlayers?.map((player) => (
              <TableRow
                key={player.externalPlayerId}
                className={cn(
                  "hover:bg-muted/50 transition-colors",
                  editingRowId === player.externalPlayerId &&
                    "!overflow-visible",
                )}
              >
                <EditableTableCell
                  value={player.name || ""}
                  onSave={(newName) => {
                    updatePlayerInfo({
                      externalPlayerId: player.externalPlayerId,
                      name: newName,
                      deckName: player.deckName || "",
                      deckList: player.deckList || "",
                    });
                    setEditingRowId(null);
                  }}
                  onEditChange={(isEditing) => {
                    setEditingRowId(
                      isEditing ? player.externalPlayerId : null,
                    );
                  }}
                  className="w-1/4 border-r border-border"
                />
                <EditableTableCell
                  value={player.deckName || ""}
                  onSave={(newDeckName) => {
                    updatePlayerInfo({
                      externalPlayerId: player.externalPlayerId,
                      name: player.name || "",
                      deckName: newDeckName,
                      deckList: player.deckList || "",
                    });
                    setEditingRowId(null);
                  }}
                  onEditChange={(isEditing) => {
                    setEditingRowId(
                      isEditing ? player.externalPlayerId : null,
                    );
                  }}
                  className="w-1/4 border-r border-border"
                />
                <EditableTableCell
                  value={player.deckList || ""}
                  onSave={(newDeckList) => {
                    updatePlayerInfo({
                      externalPlayerId: player.externalPlayerId,
                      name: player.name || "",
                      deckName: player.deckName || "",
                      deckList: newDeckList,
                    });
                    setEditingRowId(null);
                  }}
                  onEditChange={(isEditing) => {
                    setEditingRowId(
                      isEditing ? player.externalPlayerId : null,
                    );
                  }}
                  className="w-1/2"
                />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function isEliminatedRegistrationStatus(registrationStatus?: string): boolean {
  if (!registrationStatus) {
    return false;
  }

  return ELIMINATED_REGISTRATION_STATUSES.has(
    registrationStatus.trim().toUpperCase(),
  );
}

function isDay2MetaBreakdownPlayer(player: {
  registrationStatus?: string | null;
}): boolean {
  return !isEliminatedRegistrationStatus(
    player.registrationStatus ?? undefined,
  );
}

function formatMetaPercentage(value: number, decimalPlaces: number): string {
  return `${value.toFixed(decimalPlaces)}%`;
}

type DownloadMetaBreakdownImageOptions = {
  title: string;
  filename: string;
  decimalPlaces: number;
  eventName: string | null;
  rows: MetaBreakdownRow[];
  includeDay2Columns: boolean;
};

const META_BREAKDOWN_CANVAS_WIDTH = 1920;
const META_BREAKDOWN_CANVAS_HEIGHT = 1080;

const BRAUN_DARK = {
  surface: "#1C1B19",
  text: "#D4CFC5",
  muted: "#918A84",
  accent: "#E8642C",
  rule: "rgba(210,200,185,0.18)",
};

const META_BREAKDOWN_FONT_FAMILY =
  "'Instrument Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const META_BREAKDOWN_FONT_LINK_ID = "meta-breakdown-instrument-sans-link";

type MetaBreakdownArtImageByArchetype = Map<string, HTMLImageElement>;

type ScryfallCardImageUris = {
  art_crop?: string;
};

type ScryfallNamedCardResponse = {
  image_uris?: ScryfallCardImageUris;
  card_faces?: { image_uris?: ScryfallCardImageUris }[];
};

async function ensureInstrumentSansLoaded(): Promise<void> {
  if (typeof document === "undefined") return;
  if (!document.getElementById(META_BREAKDOWN_FONT_LINK_ID)) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.gstatic.com";
    preconnect.crossOrigin = "anonymous";
    document.head.appendChild(preconnect);

    const link = document.createElement("link");
    link.id = META_BREAKDOWN_FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }

  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load("400 16px 'Instrument Sans'"),
      document.fonts.load("500 16px 'Instrument Sans'"),
      document.fonts.load("600 16px 'Instrument Sans'"),
      document.fonts.load("700 16px 'Instrument Sans'"),
    ]).catch(() => undefined);
    await document.fonts.ready.catch(() => undefined);
  }
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo).trimEnd() + ellipsis;
}

async function downloadMetaBreakdownImage({
  title,
  filename,
  decimalPlaces,
  eventName,
  rows,
  includeDay2Columns,
}: DownloadMetaBreakdownImageOptions): Promise<void> {
  await ensureInstrumentSansLoaded();
  const artImagesByArchetype = await loadMetaBreakdownArtImages(rows);

  const width = META_BREAKDOWN_CANVAS_WIDTH;
  const height = META_BREAKDOWN_CANVAS_HEIGHT;

  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;

  // ── Surface ──
  ctx.fillStyle = BRAUN_DARK.surface;
  ctx.fillRect(0, 0, width, height);

  // Subtle vignette to add depth without breaking flatness
  const vignette = ctx.createRadialGradient(
    width / 2,
    height * 0.55,
    width * 0.25,
    width / 2,
    height * 0.55,
    width * 0.85,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // ── Outer frame inset ──
  const frameInset = 32;
  ctx.strokeStyle = BRAUN_DARK.rule;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    frameInset + 0.5,
    frameInset + 0.5,
    width - frameInset * 2 - 1,
    height - frameInset * 2 - 1,
  );

  // ── Layout constants ──
  const sideMargin = 140;
  const contentX = sideMargin;
  const contentWidth = width - sideMargin * 2;

  // ── Title block ──
  const titleText = title.trim() || "Meta Breakdown";
  const titleBaselineY = 176;
  drawTrackedText(ctx, titleText, contentX, titleBaselineY, {
    font: `600 96px ${META_BREAKDOWN_FONT_FAMILY}`,
    color: BRAUN_DARK.text,
    tracking: -0.022,
    align: "left",
    baseline: "alphabetic",
  });

  // Sub-header: event name in accent color (if present)
  const trimmedEventName = eventName?.trim() ?? "";
  if (trimmedEventName) {
    drawTrackedText(ctx, trimmedEventName, contentX, titleBaselineY + 50, {
      font: `400 36px ${META_BREAKDOWN_FONT_FAMILY}`,
      color: BRAUN_DARK.accent,
      tracking: 0.01,
      align: "left",
      baseline: "alphabetic",
    });
  }

  // ── Table region ──
  const tableTop = trimmedEventName ? 280 : 232;
  const tableBottom = height - 96;
  const tableX = contentX;
  const tableWidth = contentWidth;
  const availableTableHeight = tableBottom - tableTop;

  // Two side-by-side sub-columns. Left column holds rows 1..ceil(N/2); right
  // column holds the remainder, displayed at the same vertical position so
  // visual row 1 shows archetypes #1 and #(ceil(N/2)+1).
  const halfPoint = Math.ceil(rows.length / 2);
  const visualRowCount = halfPoint;

  const columnGap = 96;
  const subColumnWidth = Math.floor((tableWidth - columnGap) / 2);
  const leftSubColumnX = tableX;
  const rightSubColumnX = tableX + subColumnWidth + columnGap;

  const headerRatio = 1.35;
  const maxRowHeight = 86;
  // No min clamp — must always fit inside availableTableHeight.
  const idealRowHeight = Math.floor(
    availableTableHeight / (visualRowCount + headerRatio),
  );
  const rowHeight = Math.max(8, Math.min(maxRowHeight, idealRowHeight));
  const headerHeight = Math.floor(rowHeight * headerRatio);

  // Always anchor at the top so the eye-line above the table is consistent.
  const tableY = tableTop;

  // Within each sub-column: archetype/art cell (left) + percent columns (right).
  const percentW = Math.round(
    subColumnWidth * (includeDay2Columns ? 0.44 : 0.22),
  );
  const archetypeW = Math.min(
    subColumnWidth - percentW,
    Math.round(subColumnWidth * (includeDay2Columns ? 0.56 : 0.58)),
  );
  const metricColumnCount = includeDay2Columns ? 2 : 1;
  const metricColumnWidth = (subColumnWidth - archetypeW) / metricColumnCount;

  // ── Header row ──
  const headerFontSize = Math.max(
    9,
    Math.round(rowHeight * (includeDay2Columns ? 0.19 : 0.32)),
  );
  const headerLabelOpts = {
    font: `500 ${headerFontSize}px ${META_BREAKDOWN_FONT_FAMILY}`,
    color: BRAUN_DARK.muted,
    tracking: includeDay2Columns ? 0 : 0.24,
    baseline: "middle" as const,
  };
  const headerCenterY = tableY + headerHeight / 2;
  const cellPadding = Math.max(0, Math.round(rowHeight * 0.1));

  for (const subColumnX of [leftSubColumnX, rightSubColumnX]) {
    drawTrackedText(ctx, "ARCHETYPE", subColumnX + cellPadding, headerCenterY, {
      ...headerLabelOpts,
      align: "left",
    });
    if (includeDay2Columns) {
      ["DAY 2 %", "CONVERSION %"].forEach((label, index) => {
        drawTrackedText(
          ctx,
          label,
          subColumnX +
            archetypeW +
            metricColumnWidth * (index + 1) -
            cellPadding,
          headerCenterY,
          { ...headerLabelOpts, align: "right" },
        );
      });
    } else {
      drawTrackedText(
        ctx,
        "META %",
        subColumnX + subColumnWidth - cellPadding,
        headerCenterY,
        { ...headerLabelOpts, align: "right" },
      );
    }

    // Hairline beneath each sub-column header
    ctx.strokeStyle = BRAUN_DARK.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(subColumnX, tableY + headerHeight + 0.5);
    ctx.lineTo(subColumnX + subColumnWidth, tableY + headerHeight + 0.5);
    ctx.stroke();
  }

  // ── Data rows ──
  const bodyFontSize = Math.max(11, Math.round(rowHeight * 0.46));
  const numericFontSize = Math.max(11, Math.round(rowHeight * 0.5));

  const drawRow = (
    row: MetaBreakdownRow,
    subColumnX: number,
    centerY: number,
  ) => {
    const isOther = row.archetype === "Other";
    const rowY = centerY - rowHeight / 2;
    const artImage = artImagesByArchetype.get(row.archetype.toLowerCase());

    if (artImage) {
      drawMetaBreakdownCellArt(
        ctx,
        artImage,
        subColumnX,
        rowY,
        archetypeW,
        rowHeight,
      );
    }

    ctx.font = `500 ${bodyFontSize}px ${META_BREAKDOWN_FONT_FAMILY}`;
    const archetypeMaxWidth = archetypeW - cellPadding * 2;
    const archetypeLabel = truncateToWidth(
      ctx,
      row.archetype,
      archetypeMaxWidth,
    );
    ctx.fillStyle = isOther ? BRAUN_DARK.muted : BRAUN_DARK.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(archetypeLabel, subColumnX + cellPadding, centerY);

    ctx.font = `500 ${numericFontSize}px ${META_BREAKDOWN_FONT_FAMILY}`;
    ctx.fillStyle = isOther ? BRAUN_DARK.muted : BRAUN_DARK.text;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const drawMetric = (value: number, index: number) => {
      ctx.fillText(
        formatMetaPercentage(value, decimalPlaces),
        subColumnX + archetypeW + metricColumnWidth * (index + 1) - cellPadding,
        centerY,
      );
    };

    if (includeDay2Columns) {
      drawMetric(row.day2Percentage ?? 0, 0);
      drawMetric(row.conversionPercentage ?? 0, 1);
    } else {
      drawMetric(row.percentage, 0);
    }
  };

  for (let i = 0; i < visualRowCount; i++) {
    const centerY = tableY + headerHeight + i * rowHeight + rowHeight / 2;

    const leftRow = rows[i];
    if (leftRow) drawRow(leftRow, leftSubColumnX, centerY);

    const rightRow = rows[i + halfPoint];
    if (rightRow) drawRow(rightRow, rightSubColumnX, centerY);
  }

  const safeFilename = sanitizeFilename(filename.trim() || "meta-breakdown");
  const outputFilename = `${safeFilename}-${new Date().toISOString().slice(0, 10)}.png`;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((outputBlob) => {
      if (!outputBlob) {
        reject(new Error("Could not encode PNG"));
        return;
      }
      resolve(outputBlob);
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = outputFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function loadMetaBreakdownArtImages(
  rows: MetaBreakdownRow[],
): Promise<MetaBreakdownArtImageByArchetype> {
  const artByArchetype = new Map<string, HTMLImageElement>();
  const cardNameByArchetype = new Map<string, string>();

  for (const row of rows) {
    const keyCardName = getMetaBreakdownKeyCardName(row.archetype);
    if (keyCardName) {
      cardNameByArchetype.set(row.archetype.toLowerCase(), keyCardName);
    }
  }

  const imageByCardName = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    Array.from(new Set(cardNameByArchetype.values())).map(async (cardName) => {
      imageByCardName.set(cardName, await loadScryfallArtCropImage(cardName));
    }),
  );

  for (const [archetypeKey, cardName] of cardNameByArchetype) {
    const image = imageByCardName.get(cardName);
    if (image) {
      artByArchetype.set(archetypeKey, image);
    }
  }

  return artByArchetype;
}

async function loadScryfallArtCropImage(
  cardName: string,
): Promise<HTMLImageElement | null> {
  const artCropUrl = await fetchScryfallArtCropUrl(cardName);
  if (!artCropUrl) {
    return null;
  }
  return loadCanvasImage(artCropUrl);
}

async function fetchScryfallArtCropUrl(
  cardName: string,
): Promise<string | null> {
  try {
    const url = new URL("https://api.scryfall.com/cards/named");
    url.searchParams.set("exact", cardName);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return null;
    }
    const card = (await response.json()) as ScryfallNamedCardResponse;
    return (
      card.image_uris?.art_crop ??
      card.card_faces?.[0]?.image_uris?.art_crop ??
      null
    );
  } catch {
    return null;
  }
}

function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawMetaBreakdownCellArt(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  const imageAspect = image.naturalWidth / image.naturalHeight;
  const cellAspect = width / height;
  let drawWidth = width;
  let drawHeight = height;
  if (imageAspect > cellAspect) {
    drawHeight = height;
    drawWidth = height * imageAspect;
  } else {
    drawWidth = width;
    drawHeight = width / imageAspect;
  }

  ctx.globalAlpha = 0.42;
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  ctx.globalAlpha = 1;

  const overlay = ctx.createLinearGradient(x, y, x + width, y);
  overlay.addColorStop(0, "rgba(28,27,25,0.66)");
  overlay.addColorStop(0.72, "rgba(28,27,25,0.5)");
  overlay.addColorStop(1, "rgba(28,27,25,0.76)");
  ctx.fillStyle = overlay;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

type TrackedTextOptions = {
  font: string;
  color: string;
  tracking?: number;
  align?: "left" | "right" | "center";
  baseline?: CanvasTextBaseline;
};

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: TrackedTextOptions,
): void {
  const tracking = options.tracking ?? 0;
  ctx.font = options.font;
  ctx.fillStyle = options.color;
  ctx.textBaseline = options.baseline ?? "alphabetic";

  if (tracking === 0) {
    ctx.textAlign = options.align ?? "left";
    ctx.fillText(text, x, y);
    return;
  }

  const fontSizeMatch = options.font.match(/(\d+(?:\.\d+)?)px/);
  const fontSize = fontSizeMatch ? Number(fontSizeMatch[1]) : 16;
  const trackPx = fontSize * tracking;

  ctx.textAlign = "left";
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    totalWidth += ctx.measureText(text[i]).width;
    if (i < text.length - 1) totalWidth += trackPx;
  }

  let cursor = x;
  if (options.align === "right") cursor = x - totalWidth;
  else if (options.align === "center") cursor = x - totalWidth / 2;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + trackPx;
  }
}

function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return sanitized || "meta-breakdown";
}

function EditableTableCell({
  value,
  onSave,
  onEditChange,
  className,
}: {
  value: string;
  onSave: (newValue: string) => void;
  onEditChange?: (isEditing: boolean) => void;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [expandUpward, setExpandUpward] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Calculate expansion direction when entering edit mode
  useEffect(() => {
    if (isEditing && cellRef.current) {
      // Use requestAnimationFrame to ensure DOM has rendered, then check again
      const checkPosition = () => {
        if (cellRef.current) {
          const cellRect = cellRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const scrollArea = cellRef.current.closest(
            '[data-slot="scroll-area-viewport"]',
          );
          const scrollAreaRect = scrollArea?.getBoundingClientRect();

          // Use scroll area bounds if available, otherwise use viewport
          const availableBottom = scrollAreaRect
            ? scrollAreaRect.bottom
            : viewportHeight;
          const availableTop = scrollAreaRect ? scrollAreaRect.top : 0;

          // Use a fixed expected height for calculation (max-height we'll set)
          const expectedHeight = 300; // Max height we'll allow
          const spaceBelow = availableBottom - cellRect.bottom;
          const spaceAbove = cellRect.top - availableTop;

          // Expand upward if there's not enough space below but enough space above
          // Add a buffer (20px) to ensure it doesn't touch edges
          if (
            spaceBelow < expectedHeight + 20 &&
            spaceAbove > expectedHeight + 20
          ) {
            setExpandUpward(true);
          } else {
            setExpandUpward(false);
          }
        }
      };

      // Check immediately and after a short delay to account for rendering
      checkPosition();
      setTimeout(checkPosition, 10);
      requestAnimationFrame(() => {
        setTimeout(checkPosition, 10);
      });
    }
  }, [isEditing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(value);
    onEditChange?.(true);
  };

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
    onEditChange?.(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    onEditChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <TableCell
      ref={cellRef}
      className={cn(
        className,
        isEditing
          ? "relative !overflow-visible bg-background"
          : "cursor-pointer",
      )}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <div
          ref={containerRef}
          className={cn(
            "absolute z-50 p-[2px]",
            expandUpward ? "bottom-0 left-0" : "top-0 left-0",
          )}
        >
          <div className="min-w-[200px] w-[300px] max-h-[300px] border border-border bg-background shadow-lg rounded-md focus-within:ring-2 focus-within:ring-ring flex flex-col overflow-hidden">
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCancel}
              onKeyDown={handleKeyDown}
              className="min-h-[4rem] w-full resize-none border-0 bg-transparent dark:bg-transparent p-2 pb-8 shadow-none focus-visible:ring-0 overflow-y-auto flex-1"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                zIndex: 1000,
              }}
            />
            <div className="px-2 pb-2 text-xs text-muted-foreground flex gap-3 justify-end shrink-0">
              <span>
                <Kbd className="rounded-lg font-mono">esc</Kbd> to cancel
              </span>
              <span>
                <Kbd className="rounded-lg font-mono">⏎</Kbd> to save
              </span>
            </div>
          </div>
        </div>
      ) : (
        <span className="block truncate">
          {value || (
            <span className="text-muted-foreground italic">
              Double-click to edit
            </span>
          )}
        </span>
      )}
    </TableCell>
  );
}
