import { CommentaryOverlay as CommentaryOverlayType } from "@/convex/types";
import CommentaryDuressCrewOverlay from "./commentary-duresscrew-overlay";
import CommentaryLobsterconOverlay from "./commentary-lobstercon-overlay";
import CommentaryBraunDarkOverlay from "./commentary-braun-dark-overlay";
import CommentaryBraunDarkDuoOverlay from "./commentary-braun-dark-duo-overlay";

export default function CommentaryOverlay({
  data,
}: {
  data: CommentaryOverlayType;
}) {
  // Template mapping for better maintainability
  const TEMPLATE_COMPONENTS = {
    "Duress Crew": CommentaryDuressCrewOverlay,
    Lobstercon: CommentaryLobsterconOverlay,
    "Braun Dark": CommentaryBraunDarkOverlay,
    "Braun Dark Duo": CommentaryBraunDarkDuoOverlay,
  } as const;

  type TemplateName = keyof typeof TEMPLATE_COMPONENTS;

  const TemplateComponent = TEMPLATE_COMPONENTS[data.template as TemplateName];

  if (!TemplateComponent) {
    return <div>Template &quot;{data.template}&quot; not supported</div>;
  }

  return <TemplateComponent data={data} />;
}
