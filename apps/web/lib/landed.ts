import {
  computeLandedCost,
  serializeLandedCost,
  selectShippingCost,
  type ShippingMethod,
  type SerializedBreakdown,
} from "@carbridge/shared";
import { getVehicleDetail } from "./vehicles";
import { getCurrentSnapshot } from "./fx";
import type { VehicleDetailView } from "./types";

export interface AuthoritativeLanded {
  vehicle: VehicleDetailView;
  method: ShippingMethod;
  /** Effective (post-spread) FX rate this computation was pinned to. */
  fxRate: string;
  /** Selected shipping cost in CAD (decimal string). */
  shippingCostCAD: string;
  /** Authoritative, rounded, JSON-safe breakdown - the figures we store/lock. */
  serialized: SerializedBreakdown;
}

/**
 * Server-authoritative landed cost (SRD FR-CST-05). This is the single source
 * of truth the offer/reservation routes and the /landed-cost route all share,
 * so a locked figure can never disagree with what the ledger endpoint returns.
 *
 * Returns null only when the vehicle does not exist.
 */
export async function computeAuthoritativeLanded(
  id: string,
  requestedMethod?: ShippingMethod | null,
): Promise<AuthoritativeLanded | null> {
  const vehicle = await getVehicleDetail(id);
  if (!vehicle) return null;

  const method = (requestedMethod ?? vehicle.defaultShippingMethod) as ShippingMethod;
  const fx = await getCurrentSnapshot();

  const shippingCostCAD = selectShippingCost(
    vehicle.shippingOptions.map((o) => ({
      method: o.method,
      containerType: o.containerType ?? undefined,
      costCAD: o.costCAD,
    })),
    method,
  ).toString();

  const breakdown = computeLandedCost({
    purchasePriceCAD: vehicle.purchasePriceCAD,
    shippingCostCAD,
    clearingCostNGN: vehicle.clearingCostNGN,
    fxRate: fx.effectiveRate,
    handlingRate: vehicle.handlingRate ?? undefined,
  });

  return {
    vehicle,
    method,
    fxRate: fx.effectiveRate,
    shippingCostCAD,
    serialized: serializeLandedCost(breakdown),
  };
}
