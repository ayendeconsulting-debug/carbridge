import {
  isAdmin,
  listOffersForAdmin,
  listReservationsForAdmin,
  listCarRequestsForAdmin,
  listMatchableVehicles,
} from "@/lib/admin";
import { listVehiclesForAdmin } from "@/lib/admin-catalog";
import { listBillingForAdmin } from "@/lib/billing";
import { listUsersForAdmin, listMembershipInvoicesForAdmin } from "@/lib/memberships";
import { AdminGate } from "@/components/AdminGate";
import { AdminTabs } from "@/components/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminGate />;
  }

  const [offers, reservations, carRequests, matchable, vehicles, billing, users, memberships] =
    await Promise.all([
      listOffersForAdmin(),
      listReservationsForAdmin(),
      listCarRequestsForAdmin(),
      listMatchableVehicles(),
      listVehiclesForAdmin(),
      listBillingForAdmin(),
      listUsersForAdmin(),
      listMembershipInvoicesForAdmin(),
    ]);

  return (
    <AdminTabs
      offers={offers}
      reservations={reservations}
      carRequests={carRequests}
      matchable={matchable}
      vehicles={vehicles}
      billing={billing}
      users={users}
      memberships={memberships}
    />
  );
}
