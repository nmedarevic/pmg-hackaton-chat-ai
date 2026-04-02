# Geocoding Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverse-geocode the user's browser coordinates via Google Geocoding API at listing submission time and populate the listing's `location` field with real postcode, city, and administrative area levels.

**Architecture:** A new `geocodeLocation` utility is called inside `AnthropicAgent`'s `submit_collected_data` tool handler. It calls the Google Geocoding reverse-geocoding API and returns a structured `LocationData` object. `transformCollectedData` is updated to accept this object as an optional second argument, falling back to the hardcoded Sale, Manchester location if none is provided.

**Tech Stack:** Node.js native `fetch`, Google Geocoding REST API, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/src/geocodeLocation.ts` | Create | Call Google Geocoding API, parse response, return `LocationData \| null` |
| `server/src/transformCollectedData.ts` | Modify | Accept optional `LocationData` param, use it over hardcoded fallback |
| `server/src/agents/anthropic/AnthropicAgent.ts` | Modify | Call `geocodeLocation` before `transformCollectedData` in tool handler |

---

## Task 1: Create `geocodeLocation.ts`

**Files:**
- Create: `server/src/geocodeLocation.ts`

- [ ] **Step 1: Create the file with the `LocationData` interface and `geocodeLocation` function**

```typescript
// server/src/geocodeLocation.ts

export interface LocationData {
  coordinates: { latitude: number; longitude: number };
  raw: string;
  postalCode: string;
  city: string;
  areaLevel2: string;
  areaLevel1: string;
  country: string;
}

function extractComponent(
  components: Array<{ long_name: string; types: string[] }>,
  type: string,
): string {
  return components.find((c) => c.types.includes(type))?.long_name ?? '';
}

export async function geocodeLocation(
  latitude: number,
  longitude: number,
): Promise<LocationData | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    console.warn('[geocodeLocation] GOOGLE_GEOCODING_API_KEY is not set — skipping geocoding');
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

  let data: any;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[geocodeLocation] HTTP error ${response.status}`);
      return null;
    }
    data = await response.json();
  } catch (err) {
    console.error('[geocodeLocation] Network error:', err);
    return null;
  }

  if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
    console.warn('[geocodeLocation] No results for coordinates:', latitude, longitude);
    return null;
  }

  const result = data.results[0];
  const components: Array<{ long_name: string; types: string[] }> = result.address_components ?? [];

  return {
    coordinates: { latitude, longitude },
    raw: JSON.stringify(result),
    postalCode: extractComponent(components, 'postal_code'),
    city: extractComponent(components, 'postal_town'),
    areaLevel2: extractComponent(components, 'administrative_area_level_2'),
    areaLevel1: extractComponent(components, 'administrative_area_level_1'),
    country: extractComponent(components, 'country'),
  };
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors related to `geocodeLocation.ts`

- [ ] **Step 3: Commit**

```bash
cd server && git add src/geocodeLocation.ts
git commit -m "feat: add geocodeLocation utility for Google reverse geocoding"
```

---

## Task 2: Update `transformCollectedData.ts` to accept optional `LocationData`

**Files:**
- Modify: `server/src/transformCollectedData.ts`

- [ ] **Step 1: Add import and update function signature**

At the top of `server/src/transformCollectedData.ts`, add the import:

```typescript
import type { LocationData } from './geocodeLocation';
```

Change the function signature from:

```typescript
export function transformCollectedData(input: CollectedData): ListingPayload {
```

to:

```typescript
export function transformCollectedData(input: CollectedData, location?: LocationData | null): ListingPayload {
```

- [ ] **Step 2: Replace the hardcoded location block with a conditional**

Find the `location:` block in the returned object (currently ~lines 97–108):

```typescript
    location: {
      "coordinates": {
        "latitude": 53.4327408,
        "longitude": -2.313706
      },
      "raw": "{\"address_components\":[{\"long_name\":\"M33 7WR\",\"short_name\":\"M33 7WR\",\"types\":[\"postal_code\"]},{\"long_name\":\"Sale\",\"short_name\":\"Sale\",\"types\":[\"postal_town\"]},{\"long_name\":\"Greater Manchester\",\"short_name\":\"Greater Manchester\",\"types\":[\"administrative_area_level_2\",\"political\"]},{\"long_name\":\"England\",\"short_name\":\"England\",\"types\":[\"administrative_area_level_1\",\"political\"]},{\"long_name\":\"United Kingdom\",\"short_name\":\"GB\",\"types\":[\"country\",\"political\"]}],\"formatted_address\":\"Sale M33 7WR, UK\",\"geometry\":{\"location\":{\"lat\":53.4327408,\"lng\":-2.313706},\"viewport\":{\"south\":53.43101671238331,\"west\":-2.317349345330443,\"north\":53.43694091055722,\"east\":-2.309293545625865}},\"html_attributions\":[]}",
      "postalCode": "M33 7WR",
      "city": "Sale",
      "areaLevel2": "Greater Manchester",
      "areaLevel1": "England",
      "country": "United Kingdom"
    },
```

Replace it with:

```typescript
    location: location ?? {
      coordinates: {
        latitude: 53.4327408,
        longitude: -2.313706,
      },
      raw: "{\"address_components\":[{\"long_name\":\"M33 7WR\",\"short_name\":\"M33 7WR\",\"types\":[\"postal_code\"]},{\"long_name\":\"Sale\",\"short_name\":\"Sale\",\"types\":[\"postal_town\"]},{\"long_name\":\"Greater Manchester\",\"short_name\":\"Greater Manchester\",\"types\":[\"administrative_area_level_2\",\"political\"]},{\"long_name\":\"England\",\"short_name\":\"England\",\"types\":[\"administrative_area_level_1\",\"political\"]},{\"long_name\":\"United Kingdom\",\"short_name\":\"GB\",\"types\":[\"country\",\"political\"]}],\"formatted_address\":\"Sale M33 7WR, UK\",\"geometry\":{\"location\":{\"lat\":53.4327408,\"lng\":-2.313706},\"viewport\":{\"south\":53.43101671238331,\"west\":-2.317349345330443,\"north\":53.43694091055722,\"east\":-2.309293545625865}},\"html_attributions\":[]}",
      postalCode: 'M33 7WR',
      city: 'Sale',
      areaLevel2: 'Greater Manchester',
      areaLevel1: 'England',
      country: 'United Kingdom',
    },
```

- [ ] **Step 3: Verify it compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/src/transformCollectedData.ts
git commit -m "feat: accept optional LocationData in transformCollectedData"
```

---

## Task 3: Wire geocoding into `AnthropicAgent.ts`

**Files:**
- Modify: `server/src/agents/anthropic/AnthropicAgent.ts`

- [ ] **Step 1: Add the import at the top of the file**

After the existing imports in `server/src/agents/anthropic/AnthropicAgent.ts`, add:

```typescript
import { geocodeLocation } from '../../geocodeLocation';
```

- [ ] **Step 2: Update the `submit_collected_data` handler**

Find the block inside `handleMessage` that starts with:

```typescript
        if (toolName === 'submit_collected_data') {
          console.log('Data collection complete (raw):', JSON.stringify(input));

          const payload = transformCollectedData(input as any);
```

Replace it with:

```typescript
        if (toolName === 'submit_collected_data') {
          console.log('Data collection complete (raw):', JSON.stringify(input));

          const locationData = this.userLocation
            ? await geocodeLocation(this.userLocation.latitude, this.userLocation.longitude)
            : null;

          if (locationData) {
            console.log('[AnthropicAgent] Geocoded location:', locationData.postalCode, locationData.city);
          } else {
            console.warn('[AnthropicAgent] No geocoded location — using hardcoded fallback');
          }

          const payload = transformCollectedData(input as any, locationData);
```

- [ ] **Step 3: Verify it compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/src/agents/anthropic/AnthropicAgent.ts
git commit -m "feat: reverse-geocode user location at listing submission time"
```

---

## Task 4: Verify end-to-end

- [ ] **Step 1: Ensure `GOOGLE_GEOCODING_API_KEY` is set in `server/.env`**

The key must be set:

```
GOOGLE_GEOCODING_API_KEY=<your key>
```

If it is empty, `geocodeLocation` returns `null` and the hardcoded fallback is used — which is the safe default. No crash, just a console warning.

- [ ] **Step 2: Start the server and frontend**

```bash
# Terminal 1
cd server && npm run start

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 3: Test the happy path**

1. Open the app in the browser
2. Grant location permission when prompted
3. Start a conversation with the AI agent
4. Complete the pet listing form
5. Check server logs — you should see:

```
[geocodeLocation] fetching for <lat>, <lng>
[AnthropicAgent] Geocoded location: <actual postcode> <actual city>
Transformed listing payload: { ... location: { postalCode: "<real>", city: "<real>", ... } }
```

- [ ] **Step 4: Test the fallback path**

1. Remove or empty `GOOGLE_GEOCODING_API_KEY` in `server/.env`
2. Restart the server
3. Complete a listing
4. Check server logs — you should see:

```
[geocodeLocation] GOOGLE_GEOCODING_API_KEY is not set — skipping geocoding
[AnthropicAgent] No geocoded location — using hardcoded fallback
Transformed listing payload: { ... location: { postalCode: "M33 7WR", city: "Sale", ... } }
```

Listing creation should still succeed.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify geocoding integration complete"
```
