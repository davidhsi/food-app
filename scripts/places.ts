export interface PlacePhoto {
  name: string; // e.g. "places/PLACE_ID/photos/PHOTO_REF"
}
export interface PlaceReview {
  text?: { text: string };
}
export interface RawPlace {
  id: string;
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  businessStatus?: string;
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];
  editorialSummary?: { text: string };
  websiteUri?: string;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.location",
  "places.formattedAddress",
  "places.businessStatus",
  "places.photos",
  "places.reviews",
  "places.editorialSummary",
  "places.websiteUri",
  "nextPageToken",
].join(",");

/** Text Search (Places API New). Pages until maxResults or no nextPageToken. */
export async function searchText(
  query: string,
  apiKey: string,
  maxResults = 40,
): Promise<RawPlace[]> {
  const out: RawPlace[] = [];
  let pageToken: string | undefined;
  do {
    const body: Record<string, unknown> = { textQuery: query, pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`places searchText ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      places?: RawPlace[];
      nextPageToken?: string;
    };
    out.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && out.length < maxResults);
  return out.slice(0, maxResults);
}

/** Server-side photo media URL. The key stays server-side (proxy route only). */
export function photoMediaUrl(
  photoName: string,
  apiKey: string,
  maxWidthPx = 900,
): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}
