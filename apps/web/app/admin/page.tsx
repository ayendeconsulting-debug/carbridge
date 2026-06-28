import {
  isAdmin,
  listOffersForAdmin,
  listReservationsForAdmin,
  listCarRequestsForAdmin,
  listMatchableVehicles,
} from "@/lib/admin";
import { listVehiclesForAdmin } from "@/lib/admin-catalog";
import { AdminGate } from "@/components/AdminGate";
import { AdminTabs } from "@/components/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminGate />;
  }

  const [offers, reservations, carRequests, matchable, vehicles] = await Promise.all([
    listOffersForAdmin(),
    listReservationsForAdmin(),
    listCarRequestsForAdmin(),
    listMatchableVehicles(),
    listVehiclesForAdmin(),
  ]);

  return (
    <AdminTabs
      offers={offers}
      reservations={reservations}
      carRequests={carRequests}
      matchable={matchable}
      vehicles={vehicles}
    />
  );
}
