"use client";

import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SearchBar } from "../../../../components/search-bar";
import { useState } from "react";
import * as Scry from "scryfall-sdk";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";

interface CardControllerProps {
  cardOverlayId: Id<"overlays">;
  title?: string;
}

export function CardController({ cardOverlayId, title }: CardControllerProps) {
  const [input, setInput] = useState<string>("");
  const [cardlist, setCardlist] = useState<string[]>([]);
  const [prints, setPrints] = useState<Scry.Card[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const cardOverlay = useQuery(api.overlays.getOverlayById, {
    overlayId: cardOverlayId,
  });
  const setCard = useMutation(api.overlays.updateCardOverlay);

  const handleValueChange = async (value: string) => {
    setInput(value);
    if (value.length > 2) {
      setCardlist(await Scry.Cards.autoCompleteName(value));
    }
  };

  const handleSelect = async (value: string) => {
    setInput(value);
    const res = await Scry.Cards.byName(value);
    const printings = await res.getPrints();
    setPrints(printings);
    setCardlist([]);
    // fetch og printing first
    const ogprinting = printings.findIndex((x) => !x.reprint);
    setSelectedIndex(ogprinting);
    setCard({
      overlayId: cardOverlayId,
      cardUrl: printings[ogprinting]?.image_uris?.png ?? "",
    });
  };

  const handlePrintSelect = (value: string) => {
    setSelectedIndex(parseInt(value));
    setCard({
      overlayId: cardOverlayId,
      cardUrl: prints[parseInt(value)]?.image_uris?.png ?? "",
    });
  };

  if (!cardOverlay) {
    return <p>Loading...</p>;
  }

  if (cardOverlay.overlayType !== "card") {
    throw new Error("Overlay type mismatch");
  }

  return (
    <Card className="flex flex-col min-h-[calc(100vh-4rem)] border-r-0 border-b-0">
      <CardHeader className="">
        {title && <CardTitle>{title}</CardTitle>}
      </CardHeader>
      <CardContent className="flex flex-col justify-between flex-1 min-h-0">
        <SearchBar
          value={input}
          results={cardlist}
          onValueChange={handleValueChange}
          onSelect={handleSelect}
        />
        <div className="w-full relative">
          <Image
            src={cardOverlay.cardUrl}
            alt={"Card Image"}
            width={745}
            height={1040}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div className="py-4">
          <Select
            value={selectedIndex.toString()}
            onValueChange={handlePrintSelect}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a printing" />
            </SelectTrigger>
            <SelectContent>
              {prints.map((card, index) => (
                <SelectItem
                  key={index}
                  value={index.toString()}
                  className="cursor-pointer"
                >
                  {card.set_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
