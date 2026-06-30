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

/** A single vehicle photo (cover = position 0). */
export interface PhotoView {
  id: string;
  url: string;
  position: number;
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
  transmission: string | null;
  fuelType: string | null;
  hasClaims: boolean;
  etaLabel: string;
  /** Cover photo (position 0) when present; null falls back to generated art. */
  coverPhotoUrl: string | null;
  // cost-engine inputs (decimal strings)
  purchasePriceCAD: string;
  defaultShippingMethod: ShippingMethod;
  defaultShippingCostCAD: string;
  clearingCostNGN: string;
  handlingRate: string | null;
}

export interface VehicleDetailView extends VehicleCardView {
  vin: string | null;
  colour: string | null;
  description: string;
  photos: PhotoView[];
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

/* ---- Admin catalog (vehicle management) shapes ---- */

export interface AdminVehicleListItem {
  id: string;
  name: string;
  status: string;
  bodyType: string;
  year: number;
  conditionGrade: string;
  purchasePriceCAD: string;
  coverPhotoUrl: string | null;
  photoCount: number;
  shippingCount: number;
  hasClearing: boolean;
  updatedAt: string;
}

export interface AdminPhotoView {
  id: string;
  url: string;
  position: number;
}

export interface AdminShippingRow {
  method: ShippingMethod;
  containerType: "SHARED" | "SOLE" | null;
  costCAD: string;
  transitWeeksMin: number;
  transitWeeksMax: number;
}

export interface AdminClearingView {
  costNGN: string;
  agentName: string;
  quoteRef: string | null;
  quotedAt: string;
  validUntil: string | null;
}

export interface AdminHistoryView {
  hasClaims: boolean;
  summary: string | null;
  reportUrl: string | null;
}

export interface AdminVehicleEdit {
  id: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  bodyType: string;
  mileageKm: number;
  conditionGrade: string;
  transmission: string | null;
  fuelType: string | null;
  colour: string | null;
  vin: string | null;
  description: string;
  purchasePriceCAD: string;
  defaultShippingMethod: ShippingMethod;
  handlingRateOverride: string | null;
  status: string;
  photos: AdminPhotoView[];
  shippingOptions: AdminShippingRow[];
  clearing: AdminClearingView | null;
  history: AdminHistoryView | null;
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

export interface WatchingItemView {
  vehicleId: string;
  name: string;
  coverPhotoUrl: string | null;
  savedAt: string;
  available: boolean;
  statusNote: string | null;
  current: { ngn: string; cad: string } | null;
  savedTotal: { ngn: string; cad: string } | null;
  priceDropCAD: string | null;
  priceUpCAD: string | null;
  fxMoved: boolean;
}

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
  hasReservation: boolean;
  reservationId: string | null;
  canReserve: boolean;
  agreed: { amount: string; currency: Currency };
  vehicle: { id: string; name: string };
}

export interface MyBankInstructions {
  bankName: string;
  accountName: string;
  accountNumber: string;
  referenceHint: string | null;
  note: string | null;
}

export interface MyReservationBilling {
  quoteNumber: string | null;
  quoteStatus: string | null;
  quoteId: string | null;
  canAccept: boolean;
  invoice: {
    number: string | null;
    status: string;
    amountNGN: string;
    amountPaidNGN: string;
    dueAt: string | null;
    bank: MyBankInstructions | null;
  } | null;
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
  fromOffer: boolean;
  vehicle: { id: string; name: string };
  billing: MyReservationBilling | null;
}

export interface MyMembershipInvoiceView {
  id: string;
  number: string | null;
  status: string;
  amountNGN: string;
  amountPaidNGN: string;
  dueAt: string | null;
  bank: MyBankInstructions | null;
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

/* ---- Admin billing (quote -> invoice -> payment) shapes ---- */

export interface AdminBillingRow {
  reservationId: string;
  reservationStatus: string;
  lockedTotalNGN: string;
  lockedTotalCAD: string;
  shippingMethod: ShippingMethod;
  createdAt: string;
  vehicle: { id: string; name: string };
  buyer: { email: string; name: string | null };
  quotation: { id: string; number: string | null; status: string } | null;
  invoice: {
    id: string;
    number: string | null;
    status: string;
    amountNGN: string;
    amountPaidNGN: string;
    dueAt: string | null;
  } | null;
}

/* ---- Admin members (manual Premium) shapes ---- */
export interface AdminUserView {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  premiumExpiresAt: string | null;
}

export interface AdminMembershipInvoiceView {
  id: string;
  number: string | null;
  status: string;
  amountNGN: string;
  amountPaidNGN: string;
  createdAt: string;
  dueAt: string | null;
  buyer: { email: string; name: string | null };
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
