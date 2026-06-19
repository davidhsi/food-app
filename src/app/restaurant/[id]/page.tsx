import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRestaurant } from "@/lib/data";
import { gemScore } from "@/lib/types";
import RestaurantDetail from "./RestaurantDetail";

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const r = getRestaurant(params.id);
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

export default function RestaurantPage({ params }: { params: { id: string } }) {
  if (!getRestaurant(params.id)) notFound();
  return <RestaurantDetail id={params.id} />;
}
