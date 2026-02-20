import { CardOverlay as CardOverlayType } from "@/convex/types";
import CardDefaultOverlay from "./card-default-overlay";
import CardBraunDarkOverlay from "./card-braun-dark-overlay";

export default function CardOverlay({ data }: { data: CardOverlayType }) {
  const TEMPLATE_COMPONENTS = {
    Default: CardDefaultOverlay,
    "Braun Dark": CardBraunDarkOverlay,
  } as const;

  type TemplateName = keyof typeof TEMPLATE_COMPONENTS;

  const template = (data.template ?? "Default") as TemplateName;
  const TemplateComponent = TEMPLATE_COMPONENTS[template];

  if (!TemplateComponent) {
    return <div>Template &quot;{data.template}&quot; not supported</div>;
  }

  return <TemplateComponent data={data} />;
}
