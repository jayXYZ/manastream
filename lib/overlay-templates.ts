import { OverlayType } from "@/convex/types";

/**
 * Template names that can be used across overlay types
 */
export type TemplateName = "Default" | "Duress Crew" | "Lobstercon" | "Custom" | "Arcade" | "VHS" | "Braun" | "Braun Dark" | "Braun Dark Duo" | "Topographic" | "Brutalist";

/**
 * Configuration mapping overlay types to their available templates.
 * This is the source of truth for which templates are implemented for each overlay type.
 */
export const OVERLAY_TEMPLATES: Record<OverlayType, TemplateName[]> = {
  match: ["Default", "Duress Crew", "Lobstercon", "Arcade", "VHS", "Braun", "Braun Dark", "Topographic", "Brutalist"],
  commentary: ["Duress Crew", "Lobstercon", "Braun Dark", "Braun Dark Duo"],
  deck: ["Duress Crew"], // Currently hardcoded, but included for consistency
  card: ["Default", "Braun Dark"],
  standings: [], // Not yet implemented
};

/**
 * Get available templates for a specific overlay type
 */
export function getAvailableTemplates(
  overlayType: OverlayType,
): TemplateName[] {
  return OVERLAY_TEMPLATES[overlayType] ?? [];
}

/**
 * Check if a template is available for a specific overlay type
 */
export function isTemplateAvailable(
  overlayType: OverlayType,
  template: TemplateName,
): boolean {
  return OVERLAY_TEMPLATES[overlayType]?.includes(template) ?? false;
}

/**
 * Get all possible template names (for use in selects, etc.)
 */
export function getAllTemplateNames(): TemplateName[] {
  return ["Default", "Duress Crew", "Lobstercon", "Custom", "Arcade", "VHS", "Braun", "Braun Dark", "Braun Dark Duo", "Topographic", "Brutalist"];
}
