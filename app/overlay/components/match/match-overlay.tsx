import { MatchOverlayWithPlayers } from "@/convex/types";
import MatchDuressCrewOverlay from "./match-duresscrew-overlay";
import MatchLobsterconOverlay from "./match-lobstercon-overlay";

export default function MatchOverlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  // Template mapping for better maintainability
  const TEMPLATE_COMPONENTS = {
    "Duress Crew": MatchDuressCrewOverlay,
    Lobstercon: MatchLobsterconOverlay,
  } as const;

  type TemplateName = keyof typeof TEMPLATE_COMPONENTS;

  const TemplateComponent = TEMPLATE_COMPONENTS[data.template as TemplateName];

  if (!TemplateComponent) {
    return <div>Template &quot;{data.template}&quot; not supported</div>;
  }

  return <TemplateComponent data={data} />;
}
