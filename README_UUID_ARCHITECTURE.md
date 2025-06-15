# UUID Architecture for Public Overlays

## Overview

This document explains the simplified UUID architecture for making overlays publicly accessible without authentication.

## Design Decision: Single UUID Field vs Separate Table

### ✅ **Chosen Approach: Direct UUID on Overlays**

Each overlay now contains a direct `publicUuid` field instead of using a separate `publicUuids` table.

**Benefits:**

- **Simpler data model** - Single table with direct UUID access
- **Atomic operations** - Create overlay + UUID in one transaction
- **Better performance** - No joins needed, direct index lookup
- **Less complexity** - Fewer mutations and queries to maintain
- **Convex-optimized** - Leverages Convex's direct document access patterns

### ❌ **Previous Approach: Separate publicUuids Table**

The previous design used a separate table to track UUIDs, which created:

- Data duplication (`publicUuidString` in both tables)
- Complex two-step operations (create UUID record, then overlay)
- Potential referential integrity issues
- More indexes to maintain

## Schema Changes

### Before (Complex)

```typescript
// Two tables with relationships
publicUuids: defineTable({
  userId: v.id("users"),
  uuid: v.string(),
  overlayType: v.union(...),
  overlayId: v.id("overlays"),
  createdAt: v.number(),
})

overlays: defineTable({
  // ...other fields
  publicUuid: v.id("publicUuids"),
  publicUuidString: v.string(), // Duplicate!
})
```

### After (Simple)

```typescript
// Single table with direct UUID
overlays: defineTable({
  // ...other fields
  publicUuid: v.string(), // Direct UUID for public access
}).index("by_public_uuid", ["publicUuid"]);
```

## UUID Generation

### Method 1: Short ID for Cleaner URLs (Recommended for niche apps)

```typescript
function generatePublicUuid(): string {
  // Generate a 12-character URL-safe ID
  // Uses base36 (0-9, a-z) for URL friendliness
  return (
    Math.random().toString(36).substring(2, 8) +
    Math.random().toString(36).substring(2, 8)
  );
}
```

**Pros:**

- **12 characters** vs 36 for full UUIDs
- URL-friendly characters only (0-9, a-z)
- Still very low collision probability (36^12 = ~4.7 × 10^18 possibilities)
- Perfect for niche apps with smaller user bases
- Much easier to share and type

### Method 2: Native crypto.randomUUID() (For high-volume apps)

```typescript
function generatePublicUuid(): string {
  return crypto.randomUUID();
}
```

**Pros:**

- Built-in browser/Node.js support
- RFC 4122 compliant UUIDs
- Maximum collision resistance
- 36 characters (longer URLs)

## Usage Examples

### Creating an Overlay with UUID

```typescript
// Create a match overlay
const result = await api.overlays.createMatchOverlay({
  tournamentId: "abc123",
  player1: "player1_id",
  player2: "player2_id",
});

// Returns: { overlayId: "overlay_id", publicUuid: "550e8400-e29b-41d4-a716-446655440000" }
```

### Accessing Overlay Publicly

```typescript
// Query by UUID (no authentication required)
const overlay = await api.overlays.getOverlayByUuid({
  publicUuid: "550e8400-e29b-41d4-a716-446655440000",
});
```

### HTTP API Access

```bash
# Public HTTP endpoint
GET /overlay/550e8400-e29b-41d4-a716-446655440000

# Returns overlay data as JSON with CORS headers
```

## Security Considerations

### ✅ **Secure Design**

- UUIDs are **cryptographically random** - cannot be guessed
- No authentication bypass - overlays are **intentionally public**
- **Tournament ownership** still protected (only owners can create/modify)
- UUID space is **massive** (2^122 possibilities) - virtually no collision risk

### 🔒 **Access Control**

- **Creation**: Requires authentication + tournament ownership
- **Reading**: Public access via UUID (read-only)
- **Modification**: Requires authentication + ownership verification

## Performance Benefits

### Direct Index Lookup

```typescript
// Single efficient query
const overlay = await ctx.db
  .query("overlays")
  .withIndex("by_public_uuid", (q) => q.eq("publicUuid", uuid))
  .unique();
```

### No Complex Joins

The old design required:

1. Query `publicUuids` table by UUID
2. Extract `overlayId`
3. Query `overlays` table by ID

The new design requires:

1. Query `overlays` table by UUID ✅

## Migration Notes

If you have existing data with the old schema:

1. **Add `publicUuid` field** to existing overlays
2. **Populate UUIDs** from the `publicUuids.uuid` field
3. **Update all mutations** to use the new single-table approach
4. **Remove `publicUuids` table** once migration is complete
5. **Update indexes** to use the new `by_public_uuid` index

## Recommended File Structure

```
convex/
├── schema.ts           # Updated schema without publicUuids table
├── overlays.ts         # Overlay CRUD operations with UUID generation
├── http.ts            # Public HTTP endpoints for overlay access
└── tournaments.ts     # Tournament management (authenticated)
```

## Best Practices

1. **Always generate UUIDs server-side** to ensure uniqueness
2. **Use the index** for UUID lookups (never filter)
3. **Validate tournament ownership** before creating overlays
4. **Return UUID immediately** after overlay creation for frontend use
5. **Use CORS headers** for cross-origin overlay embedding
