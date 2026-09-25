import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// Public endpoint for accessing overlays by UUID (no auth required).
// Convex's httpRouter matches an exact `path` or a `pathPrefix`; it has no
// `:param` syntax, so the UUID is read from the end of the pathname below.
http.route({
  pathPrefix: "/api/overlay/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/");
    const uuid = pathSegments[pathSegments.length - 1];

    if (!uuid) {
      return new Response("UUID required", { status: 400 });
    }

    try {
      const overlay = await ctx.runQuery(
        internal.overlays.queries.getOverlayByUuidInternal,
        {
          publicUuid: uuid,
        },
      );

      if (!overlay) {
        return new Response("Overlay not found", { status: 404 });
      }

      return new Response(JSON.stringify(overlay), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // Allow CORS for overlay usage
        },
      });
    } catch (error) {
      console.error("Error fetching overlay:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }),
});

export default http;
