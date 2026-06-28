// Plain, serializable view-models passed from server components to client
// components. Decoupled from Prisma's generated types so all UI + cost logic
// type-checks independently of `prisma generate`.

import type { ShippingMethod } from "@carbridge/shared";

export type Tier = "GUEST" | "REGISTERED" | "PREMIUM";

export type Currency = "CAD" | "NGN";

export interface ShippingOptionView {
  method: ShippingMethod;
  containerType: "SHARED" | "SOLE" | null;
  costCAD: string;
  transitWeeksMin: number;
  transitWeeksMax: number;
}

/** The numbers the cost engine needs, plus presentation fields. */
export interface VehicleCardView {
  id: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  bodyType: string;
  mileageKm: number;
  conditionGrade: string;
  hasClaims: boolean;
  etaLabel: string;
  // cost-engine inputs (decimal strings)
  purchasePriceCAD: string;
  defaultShippingMethod: ShippingMethod;
  defaultShippingCostCAD: string;
  clearingCostNGN: string;
  handlingRate: string | null;
}

export interface VehicleDetailView extends VehicleCardView {
  vin: string | null;
  description: string;
  shippingOptions: ShippingOptionView[];
  clearing: {
    costNGN: string;
    agentName: string;
    validUntil: string | null;
  } | null;
  history: { hasClaims: boolean; summary: string | null } | null;
}

/* ---- Offer & reservation transport shapes ---- */

export interface OfferRequest {
  vehicleId: string;
  method: ShippingMethod;
  amount: string;
  currency: Currency;
}

export interface OfferResult {
  id: string;
  status: string;
  amount: string;
  currency: Currency;
  rateLock: { rate: string; expiresAt: string };
  listedTotal: { ngn: string; cad: string };
}

export interface ReservationRequest {
  vehicleId: string;
  method: ShippingMethod;
}

export interface ReservationResult {
  id: string;
  status: string;
  lockedTotal: { ngn: string; cad: string };
  rateLock: { rate: string; expiresAt: string };
  expiresAt: string;
}

/* ---- Admin console list shapes ---- */

export interface AdminVehicleRef {
  id: string;
  name: string; // "2020 Ford Edge"
}

export interface AdminBuyerRef {
  email: string;
  name: string | null;
}

export interface AdminOfferView {
  id: string;
  status: string;
  amount: string;
  currency: Currency;
  shippingMethod: ShippingMethod;
  createdAt: string;
  rateExpiresAt: string | null;
  rateExpired: boolean;
  listedTotal: { ngn: string; cad: string } | null;
  counter: { amount: string; currency: Currency } | null;
  vehicle: AdminVehicleRef;
  buyer: AdminBuyerRef;
}

export interface AdminReservationView {
  id: string;
  status: string;
  lockedTotalNGN: string;
  lockedTotalCAD: string;
  shippingMethod: ShippingMethod;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
  vehicle: AdminVehicleRef;
  buyer: AdminBuyerRef;
}

/* ---- Subscription / checkout transport shapes ---- */

export interface PlanView {
  name: string;
  priceNgn: string;
}

export interface CheckoutResult {
  authorizationUrl?: string;
  reference?: string;
  alreadyPremium?: boolean;
  error?: string;
}

/* ---- Buyer "My activity" shapes ---- */

export interface MyOfferView {
  id: string;
  status: string;
  amount: string;
  currency: Currency;
  shippingMethod: ShippingMethod;
  createdAt: string;
  rateExpiresAt: string | null;
  rateExpired: boolean;
  listedTotal: { ngn: string; cad: string } | null;
  counter: { amount: string; currency: Currency } | null;
  canRespond: boolean;
  vehicle: { id: string; name: string };
}

export interface MyReservationView {
  id: string;
  status: string;
  lockedTotalNGN: string;
  lockedTotalCAD: string;
  shippingMethod: ShippingMethod;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
  vehicle: { id: string; name: string };
}

export interface MySubscriptionView {
  plan: string;
  status: string;
  startedAt: string;
  expiresAt: string;
}

/* ---- Car request (Source-a-Car) shapes ---- */

export interface CarWishlist {
  make: string | null;
  model: string | null;
  yearMin: number | null;
  yearMax: number | null;
  bodyType: string | null;
  maxMileageKm: number | null;
}

export interface VehicleOption {
  id: string;
  name: string;
}

export interface AdminCarRequestView {
  id: string;
  status: string;
  createdAt: string;
  buyer: { email: string; name: string | null };
  budget: { amount: string; currency: Currency };
  wishlist: CarWishlist;
  notes: string | null;
  adminNote: string | null;
  matched: VehicleOption | null;
}

export interface MyCarRequestView {
  id: string;
  status: string;
  createdAt: string;
  budget: { amount: string; currency: Currency };
  wishlist: CarWishlist;
  notes: string | null;
  adminNote: string | null;
  matched: VehicleOption | null;
}

/** Current FX snapshot shape used across the UI and the /api/fx routes. */
export interface FxView {
  pair: "CAD_NGN";
  rawRate: string;
  effectiveRate: string;
  source: string;
  fetchedAt: string; // ISO
  isStale: boolean;
  ageSeconds: number;
}
