import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFullRestaurant } from "@/lib/data.server";
import { gemScore } from "@/lib/types";
import RestaurantDetail from "@/components/RestaurantDetail";

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const r = getFullRestaurant(params.id);
  if (!r) return { title: "Not found" };

  const where = `${r.cuisines.join(", ")} in ${r.neighborhood}, ${r.city}`;
  const score = (gemScore(r) * 10).toFixed(1);
  const description = r.insiderTip
    ? `${where}. ${r.insiderTip}`
    : `${where} — a ◆ ${score} hidden gem on Truffle.`;

  return {
    title: r.name,
    description,
    openGraph: {
      title: `${r.name} — ${r.neighborhood}`,
      description,
      type: "article",
    },
    twitter: {
      title: `${r.name} — ${r.neighborhood}`,
      description,
    },
  };
}

/**
 * Server component: loads the FULL record (incl. detail-only editorial) for this
 * id on the server, so the client never ships those fields for the whole
 * dataset. The interactive view lives in the `RestaurantDetail` client
 * component. `getFullRestaurant` is the single seam a future DB would replace.
 */
export default function RestaurantPage({ params }: { params: { id: string } }) {
  const restaurant = getFullRestaurant(params.id);
  if (!restaurant) notFound();
  return <RestaurantDetail restaurant={restaurant} />;
}
