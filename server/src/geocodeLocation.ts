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

  console.log(`[geocodeLocation] fetching for ${latitude}, ${longitude}`);

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

  let data: any;
  try {
    const response = await fetch(url);
    data = await response.json();

    if (data.status !== 'OK') {
      console.error(`[geocodeLocation] API error status: ${data.status}`);
      return null;
    }
  } catch (err) {
    console.error('[geocodeLocation] Network error:', err);
    return null;
  }

  if (!data.results?.length) {
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
