import { MatchOverlayWithPlayers } from "@/convex/types";
import MatchDuressCrewOverlay from "./match-duresscrew-overlay";
import MatchLobsterconOverlay from "./match-lobstercon-overlay";
import MatchDefaultOverlay from "./match-default-overlay";
import MatchBraunDarkOverlay from "./match-braun-dark-overlay";
import MatchLC26Overlay from "./match-lc26-overlay";

export default function MatchOverlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  // Template mapping for better maintainability
  const TEMPLATE_COMPONENTS = {
    "Duress Crew": MatchDuressCrewOverlay,
    Lobstercon: MatchLobsterconOverlay,
    Default: MatchDefaultOverlay,
    "Braun Dark": MatchBraunDarkOverlay,
    LC26: MatchLC26Overlay,
  } as const;

  type TemplateName = keyof typeof TEMPLATE_COMPONENTS;

  const TemplateComponent =
    TEMPLATE_COMPONENTS[data.template as TemplateName] ?? MatchDefaultOverlay;

  return <TemplateComponent data={data} />;
}
