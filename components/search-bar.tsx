"use client";

import { useState } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

export function SearchBar({
  value,
  results,
  onValueChange,
  onSelect,
}: {
  value: string;
  results: string[];
  onValueChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open}>
      <Command>
        <PopoverAnchor asChild>
          <CommandInput
            placeholder="Search…"
            value={value}
            onValueChange={onValueChange}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
          />
        </PopoverAnchor>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              {results.map((result) => (
                <CommandItem
                  key={result}
                  value={result}
                  onSelect={() => onSelect(result)}
                >
                  {result}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}

export default SearchBar;
