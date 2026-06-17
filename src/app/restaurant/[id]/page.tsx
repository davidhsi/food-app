import { getFullRestaurant } from "@/lib/data.server";
import RestaurantDetail from "@/components/RestaurantDetail";

/**
 * Server component: loads the FULL record (incl. detail-only editorial) for this
 * id on the server, so the client never ships those fields for the whole
 * dataset. The interactive view lives in the `RestaurantDetail` client
 * component. `getFullRestaurant` is the single seam a future DB would replace.
 */
export default function RestaurantPage({
  params,
}: {
  params: { id: string };
}) {
  const restaurant = getFullRestaurant(params.id);

  if (!restaurant) {
    return (
      <div className="phone-shell flex items-center justify-center text-ink-soft">
        Restaurant not found.
      </div>
    );
  }

  return <RestaurantDetail restaurant={restaurant} />;
}
