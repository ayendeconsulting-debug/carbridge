import {
  isAdmin,
  listOffersForAdmin,
  listReservationsForAdmin,
  listCarRequestsForAdmin,
  listMatchableVehicles,
} from "@/lib/admin";
import { AdminGate } from "@/components/AdminGate";
import { AdminConsole } from "@/components/AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminGate />;
  }

  const [offers, reservations, carRequests, matchable] = await Promise.all([
    listOffersForAdmin(),
    listReservationsForAdmin(),
    listCarRequestsForAdmin(),
    listMatchableVehicles(),
  ]);

  return (
    <AdminConsole
      offers={offers}
      reservations={reservations}
      carRequests={carRequests}
      matchable={matchable}
    />
  );
}
