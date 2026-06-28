import {
  getCurrentUser,
  getMyOffers,
  getMyReservations,
  getMySubscription,
  getMyCarRequests,
} from "@/lib/account";
import { MyActivity } from "@/components/MyActivity";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div style={{ maxWidth: 460, margin: "70px auto 0", padding: "0 20px", textAlign: "center" }}>
        <h1 className="exp" style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>No account found</h1>
        <p style={{ color: "var(--steel)" }}>Run the demo seed to create users, then come back.</p>
      </div>
    );
  }

  const [offers, reservations, subscription, carRequests] = await Promise.all([
    getMyOffers(user.id),
    getMyReservations(user.id),
    getMySubscription(user.id),
    getMyCarRequests(user.id),
  ]);

  return (
    <MyActivity
      tier={user.tier}
      subscription={subscription}
      reservations={reservations}
      offers={offers}
      carRequests={carRequests}
    />
  );
}
