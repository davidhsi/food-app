import { NextRequest, NextResponse } from "next/server";
import { getFullRestaurant } from "@/lib/data.server";
import { buildLocalOrderGuide } from "@/lib/order";
import { askClaudeOrder } from "@/lib/order.server";
import { TasteProfile } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  restaurantId: string;
  profile: TasteProfile;
}

/**
 * "Ordering for you" — personalized "what to order" guide for a single
 * restaurant. Uses Claude when ANTHROPIC_API_KEY is set to pick dishes from the
 * restaurant's real `signatureDishes` and explain why they fit the user's taste;
 * falls back to the deterministic local guide otherwise, so it always works
 * without a key. (The detail page also renders the local guide instantly and
 * only swaps in this response if it's richer.)
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { restaurantId, profile } = body;
  const r = restaurantId ? getFullRestaurant(restaurantId) : undefined;
  if (!r) {
    return NextResponse.json({ error: "unknown restaurant" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const guide = await askClaudeOrder(apiKey, r, profile);
      if (guide) return NextResponse.json({ ...guide, engine: "claude" });
    } catch (e) {
      console.error("Claude order guide failed, using local:", e);
    }
  }

  return NextResponse.json({
    ...buildLocalOrderGuide(r, profile),
    engine: "local",
  });
}
