import {
  listOffersForAdmin,
  listReservationsForAdmin,
  listCarRequestsForAdmin,
  listMatchableVehicles,
} from "@/lib/admin";
import { listVehiclesForAdmin } from "@/lib/admin-catalog";
import { listBillingForAdmin } from "@/lib/billing";
import { listUsersForAdmin, listMembershipInvoicesForAdmin } from "@/lib/memberships";
import { getAuthContext } from "@/lib/auth";
import { getCurrentSnapshot } from "@/lib/fx";
import { AppHeader } from "@/components/AppHeader";
import { AdminGate } from "@/components/AdminGate";
import { AdminTabs } from "@/components/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await getAuthContext();
  if (!ctx.isAdmin) {
    return <AdminGate />;
  }

  const [fx, offers, reservations, carRequests, matchable, vehicles, billing, users, memberships] =
    await Promise.all([
      getCurrentSnapshot(),
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
    <div className="app">
      <AppHeader fx={fx} tier={ctx.tier} isAdmin={ctx.isAdmin} />
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
    </div>
  );
}
