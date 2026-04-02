# Design: Google Geocoding for Listing Location

**Date:** 2026-04-02  
**Status:** Approved

## Overview

The frontend already captures the user's browser geolocation (latitude/longitude) and sends it to the server when starting the AI agent. The server receives it but currently uses a hardcoded Sale, Manchester location in every listing payload. This spec describes wiring the real coordinates to the Google Geocoding API to produce a proper structured location object for each listing.

## Goal

When the AI agent's `submit_collected_data` tool is called, reverse-geocode the user's coordinates via the Google Geocoding API and populate the listing's `location` field with real postcode, city, and administrative area levels instead of the hardcoded fallback.

## Files Changed

| File | Change |
|------|--------|
| `server/src/geocodeLocation.ts` | New utility — calls Google Geocoding API |
| `server/src/transformCollectedData.ts` | Accept optional `LocationData` parameter |
| `server/src/agents/anthropic/AnthropicAgent.ts` | Call `geocodeLocation` at submit time |

## Data Flow

```
Browser geolocation
  └─► frontend: getUserLocation() → { latitude, longitude }
        └─► POST /start-ai-agent { user_location: { lat, lng } }
              └─► AnthropicAgent stores this.userLocation
                    └─► submit_collected_data tool triggered
                          └─► geocodeLocation(lat, lng)  ← NEW
                                └─► Google Geocoding API (reverse)
                                      └─► LocationData { postalCode, city, areaLevel2, areaLevel1, country, coordinates, raw }
                                            └─► transformCollectedData(input, locationData)
                                                  └─► ListingPayload.location populated
                                                        └─► createPmgListing(payload, imageUrl)
```

## Section 1 — `server/src/geocodeLocation.ts`

New file. Exports:

```typescript
export interface LocationData {
  coordinates: { latitude: number; longitude: number };
  raw: string;            // stringified full Google Geocoding response
  postalCode: string;
  city: string;
  areaLevel2: string;
  areaLevel1: string;
  country: string;
}

export async function geocodeLocation(
  latitude: number,
  longitude: number,
): Promise<LocationData | null>
```

Implementation:
- Reads `GOOGLE_GEOCODING_API_KEY` from `process.env`; returns `null` if missing
- Calls `https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={key}` using native `fetch`
- Returns `null` on non-OK HTTP response or `ZERO_RESULTS` status
- Parses `address_components` array, extracting `long_name` for each type:
  - `postal_code` → `postalCode`
  - `postal_town` → `city`
  - `administrative_area_level_2` → `areaLevel2`
  - `administrative_area_level_1` → `areaLevel1`
  - `country` → `country`
- Sets `coordinates` from the input lat/lng
- Sets `raw` to `JSON.stringify` of the first result object
- Logs a warning and returns `null` on any error

## Section 2 — `server/src/transformCollectedData.ts`

- Import `LocationData` from `geocodeLocation.ts`
- Add optional second parameter: `location?: LocationData | null`
- If `location` is provided and truthy, use it for `ListingPayload.location`
- Otherwise fall back to the existing hardcoded Sale, Manchester object (no breaking change)

## Section 3 — `server/src/agents/anthropic/AnthropicAgent.ts`

In the `submit_collected_data` tool handler:

```typescript
// Before transformCollectedData
const locationData = this.userLocation
  ? await geocodeLocation(this.userLocation.latitude, this.userLocation.longitude)
  : null;

const payload = transformCollectedData(input as any, locationData);
```

No other changes to the agent.

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `GOOGLE_GEOCODING_API_KEY` not set | `geocodeLocation` returns `null`, logs warning; hardcoded fallback used |
| Network failure | Returns `null`, logs error; hardcoded fallback used |
| Zero results from API | Returns `null`, logs warning; hardcoded fallback used |
| User did not grant location permission | `this.userLocation` is `null`; `geocodeLocation` not called; hardcoded fallback used |

## Out of Scope

- Caching geocoded results
- Frontend-side geocoding
- Other agents (OpenAI agent uses same `transformCollectedData` — it will automatically benefit from the optional parameter but is not wired to geocoding in this change)
