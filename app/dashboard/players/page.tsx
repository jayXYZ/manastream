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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { SearchIcon, X } from "lucide-react";

export default function PlayersPage() {
  const players = useQuery(api.player.getAllSpicerackTournamentPlayers);
  const updatePlayerInfo = useMutation(api.player.updatePlayerInfo);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const filteredPlayers = useMemo(() => {
    return players?.filter(
      (player) =>
        player.name?.toLowerCase().includes(search.toLowerCase()) ||
        player.deckName?.toLowerCase().includes(search.toLowerCase()) ||
        player.deckList?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [players, search]);
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
          <div>
            <span className="text-sm text-muted-foreground">
              {filteredPlayers?.length !== players?.length
                ? `${filteredPlayers?.length}/`
                : ""}
              {players?.length} players
            </span>
          </div>
        </div>
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
