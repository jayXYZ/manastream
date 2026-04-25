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
import { Switch } from "@/components/ui/switch";
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
import { Download, Eye, EyeOff, SearchIcon, Settings2, X } from "lucide-react";

type MetaBreakdownDialogSettings = {
  title: string;
  filename: string;
  minMetaPercent: number;
  maxRows: number;
  decimalPlaces: number;
  includeCountColumn: boolean;
};

const defaultMetaBreakdownSettings: MetaBreakdownDialogSettings = {
  title: "Meta Breakdown",
  filename: "meta-breakdown",
  minMetaPercent: 0,
  maxRows: 15,
  decimalPlaces: 1,
  includeCountColumn: true,
};

const ELIMINATED_REGISTRATION_STATUSES = new Set([
  "DROPPED",
  "ELIMINATED",
  "DISQUALIFIED",
  "CANCELED",
  "ON_WAITLIST",
]);

export default function PlayersPage() {
  const players = useQuery(api.player.getAllSpicerackTournamentPlayers);
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
    const breakdown = buildMetaBreakdown(players);
    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: metaBreakdownSettings.minMetaPercent,
      maxRows: metaBreakdownSettings.maxRows,
    });
    return {
      totalKnownDecklists: breakdown.totalKnownDecklists,
      rows,
    };
  }, [
    players,
    metaBreakdownSettings.minMetaPercent,
    metaBreakdownSettings.maxRows,
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
    const breakdown = buildMetaBreakdown(players);
    if (breakdown.totalKnownDecklists === 0) {
      setMetaBreakdownError("No players with known decklists were found.");
      return;
    }
    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: metaBreakdownSettings.minMetaPercent,
      maxRows: metaBreakdownSettings.maxRows,
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
        includeCountColumn: metaBreakdownSettings.includeCountColumn,
        totalKnownDecklists: breakdown.totalKnownDecklists,
        rows,
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
            <div className="flex items-end justify-between gap-3 rounded-md border p-3">
              <div>
                <Label htmlFor="meta-breakdown-count-column">
                  Include Count Column
                </Label>
                <p className="text-sm text-muted-foreground">
                  Adds a players column in the exported table.
                </p>
              </div>
              <Switch
                id="meta-breakdown-count-column"
                checked={metaBreakdownSettings.includeCountColumn}
                onCheckedChange={(checked) =>
                  setMetaBreakdownSettings((previous) => ({
                    ...previous,
                    includeCountColumn: checked,
                  }))
                }
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {metaBreakdownPreview
              ? `${metaBreakdownPreview.rows.length} archetypes from ${metaBreakdownPreview.totalKnownDecklists} players with known decklists.`
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
                key={player.spicerackPlayerId}
                className={cn(
                  "hover:bg-muted/50 transition-colors",
                  editingRowId === player.spicerackPlayerId &&
                    "!overflow-visible",
                )}
              >
                <EditableTableCell
                  value={player.name || ""}
                  onSave={(newName) => {
                    updatePlayerInfo({
                      spicerackPlayerId: player.spicerackPlayerId,
                      name: newName,
                      deckName: player.deckName || "",
                      deckList: player.deckList || "",
                    });
                    setEditingRowId(null);
                  }}
                  onEditChange={(isEditing) => {
                    setEditingRowId(
                      isEditing ? player.spicerackPlayerId : null,
                    );
                  }}
                  className="w-1/4 border-r border-border"
                />
                <EditableTableCell
                  value={player.deckName || ""}
                  onSave={(newDeckName) => {
                    updatePlayerInfo({
                      spicerackPlayerId: player.spicerackPlayerId,
                      name: player.name || "",
                      deckName: newDeckName,
                      deckList: player.deckList || "",
                    });
                    setEditingRowId(null);
                  }}
                  onEditChange={(isEditing) => {
                    setEditingRowId(
                      isEditing ? player.spicerackPlayerId : null,
                    );
                  }}
                  className="w-1/4 border-r border-border"
                />
                <EditableTableCell
                  value={player.deckList || ""}
                  onSave={(newDeckList) => {
                    updatePlayerInfo({
                      spicerackPlayerId: player.spicerackPlayerId,
                      name: player.name || "",
                      deckName: player.deckName || "",
                      deckList: newDeckList,
                    });
                    setEditingRowId(null);
                  }}
                  onEditChange={(isEditing) => {
                    setEditingRowId(
                      isEditing ? player.spicerackPlayerId : null,
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

function formatMetaPercentage(value: number, decimalPlaces: number): string {
  return `${value.toFixed(decimalPlaces)}%`;
}

type DownloadMetaBreakdownImageOptions = {
  title: string;
  filename: string;
  decimalPlaces: number;
  includeCountColumn: boolean;
  totalKnownDecklists: number;
  rows: MetaBreakdownRow[];
};

async function downloadMetaBreakdownImage({
  title,
  filename,
  decimalPlaces,
  includeCountColumn,
  totalKnownDecklists,
  rows,
}: DownloadMetaBreakdownImageOptions): Promise<void> {
  const horizontalPadding = 72;
  const titleHeight = 112;
  const headerHeight = 52;
  const rowHeight = 42;
  const footerHeight = 56;
  const width = 1100;
  const tableWidth = width - horizontalPadding * 2;
  const tableX = horizontalPadding;
  const tableY = titleHeight;
  const height =
    titleHeight + headerHeight + rowHeight * rows.length + footerHeight;

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

  ctx.fillStyle = "#0B1220";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title.trim() || "Meta Breakdown", tableX, 54);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(
    `${totalKnownDecklists} players with known decklists`,
    tableX,
    86,
  );

  ctx.fillStyle = "#1E293B";
  ctx.fillRect(tableX, tableY, tableWidth, headerHeight);

  const archetypeColumnWidth = Math.floor(
    tableWidth * (includeCountColumn ? 0.58 : 0.73),
  );
  const countColumnWidth = includeCountColumn
    ? Math.floor(tableWidth * 0.16)
    : 0;
  const archetypeTextX = tableX + 20;
  const countTextX = tableX + archetypeColumnWidth + countColumnWidth - 20;
  const percentageTextX = tableX + tableWidth - 20;

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText("Archetype", archetypeTextX, tableY + headerHeight / 2);
  if (includeCountColumn) {
    ctx.textAlign = "right";
    ctx.fillText("Players", countTextX, tableY + headerHeight / 2);
  }
  ctx.textAlign = "right";
  ctx.fillText("Meta %", percentageTextX, tableY + headerHeight / 2);

  for (const [index, row] of rows.entries()) {
    const y = tableY + headerHeight + index * rowHeight;
    ctx.fillStyle = index % 2 === 0 ? "#111827" : "#0F172A";
    ctx.fillRect(tableX, y, tableWidth, rowHeight);

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(row.archetype, archetypeTextX, y + rowHeight / 2);
    if (includeCountColumn) {
      ctx.textAlign = "right";
      ctx.fillText(`${row.count}`, countTextX, y + rowHeight / 2);
    }
    ctx.textAlign = "right";
    ctx.fillText(
      formatMetaPercentage(row.percentage, decimalPlaces),
      percentageTextX,
      y + rowHeight / 2,
    );
  }

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    tableX,
    tableY,
    tableWidth,
    headerHeight + rowHeight * rows.length,
  );
  ctx.beginPath();
  ctx.moveTo(tableX + archetypeColumnWidth, tableY);
  ctx.lineTo(
    tableX + archetypeColumnWidth,
    tableY + headerHeight + rowHeight * rows.length,
  );
  if (includeCountColumn) {
    ctx.moveTo(tableX + archetypeColumnWidth + countColumnWidth, tableY);
    ctx.lineTo(
      tableX + archetypeColumnWidth + countColumnWidth,
      tableY + headerHeight + rowHeight * rows.length,
    );
  }
  ctx.stroke();

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
