import { track as vercelTrack } from "@vercel/analytics";

/**
 * Thin, typed wrapper over Vercel Analytics custom events. Centralizing the
 * event names here keeps the funnel vocabulary consistent and makes it trivial
 * to swap sinks later. Calls are safe on the server / before the script loads
 * (Vercel's `track` no-ops outside the browser).
 */
export type AnalyticsEvent =
  | "onboarding_complete"
  | "restaurant_view"
  | "save_toggle"
  | "like_toggle"
  | "rank_complete"
  | "share_spot"
  | "search_submit"
  | "assistant_query"
  | "help_me_decide"
  | "neighborhood_select";

type Props = Record<string, string | number | boolean | null>;

export function track(event: AnalyticsEvent, props?: Props): void {
  try {
    vercelTrack(event, props);
  } catch {
    // Analytics must never break a user interaction.
  }
}
