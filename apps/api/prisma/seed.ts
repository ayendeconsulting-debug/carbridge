import { PrismaClient } from "@prisma/client";

// Seeding runs over the DIRECT connection (no -pooler). Neon's pooled URL
// routes through PgBouncer in transaction mode, which breaks the prepared
// statements a seed relies on. Falls back to DATABASE_URL for local Postgres.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});

type Seed = {
  make: string;
  model: string;
  trim: string;
  year: number;
  body: "SUV" | "SEDAN";
  trans: "AUTOMATIC" | "MANUAL";
  fuel: "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC";
  colour: string;
  km: number;
  grade: string;
  vin: string;
  p: string; // purchase CAD
  roro: string; // RoRo CAD
  cont: string; // container CAD
  clr: string; // clearing NGN
  clean: boolean;
  etaMin: number;
  etaMax: number;
  desc: string;
};

const VEHICLES: Seed[] = [
  { make: "Toyota", model: "RAV4 XLE", trim: "AWD", year: 2019, body: "SUV", trans: "AUTOMATIC", fuel: "PETROL", colour: "Silver", km: 78400, grade: "A", vin: "2T3WFREV6KW012845", p: "26900", roro: "1650", cont: "2300", clr: "3100000", clean: true, etaMin: 6, etaMax: 8, desc: "One-owner Ontario SUV, dealer-serviced with full records. New all-season tyres at 74,000 km. AWD, heated seats, CarPlay. Inspected and ready for RoRo from Halifax." },
  { make: "Honda", model: "Accord Touring", trim: "2.0T", year: 2018, body: "SEDAN", trans: "AUTOMATIC", fuel: "PETROL", colour: "Grey", km: 96200, grade: "B+", vin: "1HGCV2F95JA027431", p: "21500", roro: "1450", cont: "2050", clr: "2400000", clean: true, etaMin: 6, etaMax: 8, desc: "Fully-loaded Touring — ventilated leather, head-up display, adaptive cruise. Highway-driven, non-smoker. Minor stone chips on hood noted in report. Strong, economical 2.0T." },
  { make: "Lexus", model: "RX 350", trim: "AWD Premium", year: 2020, body: "SUV", trans: "AUTOMATIC", fuel: "PETROL", colour: "White", km: 64800, grade: "A", vin: "2T2BZMCA8LC158902", p: "41800", roro: "1850", cont: "2500", clr: "3600000", clean: true, etaMin: 7, etaMax: 9, desc: "Premium package — panoramic roof, Mark Levinson audio, navigation. Immaculate, garage-kept. A flagship Lexus that holds value exceptionally well in the Lagos market." },
  { make: "Ford", model: "Edge Titanium", trim: "AWD", year: 2017, body: "SUV", trans: "AUTOMATIC", fuel: "PETROL", colour: "Grey", km: 119500, grade: "B", vin: "2FMDK3JC4ABA12345", p: "17900", roro: "1750", cont: "2400", clr: "2600000", clean: false, etaMin: 6, etaMax: 8, desc: "Spacious Titanium-trim Edge — panoramic roof, cooled seats. One reported minor rear claim in 2021, fully repaired and documented. Higher mileage reflected in the sharp price." },
  { make: "Mercedes-Benz", model: "GLC 300", trim: "4MATIC", year: 2019, body: "SUV", trans: "AUTOMATIC", fuel: "PETROL", colour: "Black", km: 71300, grade: "A-", vin: "WDC0G4KB1KV123987", p: "34600", roro: "1800", cont: "2450", clr: "3300000", clean: true, etaMin: 7, etaMax: 9, desc: "4MATIC all-wheel drive, Burmester sound, ambient lighting. Off-lease with complete Mercedes service history. A premium badge that commands strong resale among Lagos buyers." },
  { make: "Toyota", model: "Highlander XLE", trim: "AWD", year: 2016, body: "SUV", trans: "AUTOMATIC", fuel: "PETROL", colour: "White", km: 134000, grade: "B", vin: "5TDJKRFH8GS284516", p: "19400", roro: "1800", cont: "2450", clr: "2600000", clean: true, etaMin: 6, etaMax: 8, desc: "7-seater family hauler with legendary Toyota reliability. Well-maintained, recent timing service. Higher km but mechanically sound. Clearing quoted manually by our Lagos agent." },
];

async function main() {
  console.log("Seeding CarBridge…");

  // Clear in dependency order (idempotent reseed)
  await prisma.offer.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.carRequest.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.historyReport.deleteMany();
  await prisma.clearingQuote.deleteMany();
  await prisma.shippingOption.deleteMany();
  await prisma.vehiclePhoto.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.rateLock.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();

  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  for (const v of VEHICLES) {
    await prisma.vehicle.create({
      data: {
        make: v.make,
        model: v.model,
        trim: v.trim,
        year: v.year,
        bodyType: v.body,
        mileageKm: v.km,
        conditionGrade: v.grade,
        transmission: v.trans,
        fuelType: v.fuel,
        colour: v.colour,
        vin: v.vin,
        description: v.desc,
        purchasePriceCAD: v.p,
        defaultShippingMethod: "RORO",
        status: "AVAILABLE",
        shippingOptions: {
          create: [
            { method: "RORO", costCAD: v.roro, transitWeeksMin: v.etaMin, transitWeeksMax: v.etaMax },
            { method: "CONTAINER", costCAD: v.cont, transitWeeksMin: v.etaMin, transitWeeksMax: v.etaMax + 1 },
          ],
        },
        clearingQuotes: {
          create: {
            costNGN: v.clr,
            agentName: "Lagos Clearing Partners",
            quoteRef: `CB-CLR-${v.vin.slice(-5)}`,
            validUntil,
          },
        },
        historyReport: {
          create: {
            hasClaims: !v.clean,
            summary: v.clean
              ? "Clean history — no reported accidents or claims."
              : "One minor rear claim (2021), fully repaired and documented.",
          },
        },
      },
    });
    console.log(`  ✓ ${v.year} ${v.make} ${v.model}`);
  }

  // Seed an initial FX snapshot (raw 1150, +150 bps spread => 1167.25)
  await prisma.fxRate.create({
    data: {
      pair: "CAD_NGN",
      rawRate: "1150",
      effectiveRate: "1167.25",
      source: "seed",
      isStale: false,
    },
  });

  // Demo users for testing tier gating in Stage 2 (Clerk replaces these)
  await prisma.user.createMany({
    data: [
      { clerkId: "demo_registered", email: "registered@carbridge.test", name: "Demo Registered", tier: "REGISTERED" },
      { clerkId: "demo_premium", email: "premium@carbridge.test", name: "Demo Premium", tier: "PREMIUM" },
    ],
  });

  const counts = {
    vehicles: await prisma.vehicle.count(),
    shippingOptions: await prisma.shippingOption.count(),
    clearingQuotes: await prisma.clearingQuote.count(),
    users: await prisma.user.count(),
  };
  console.log("Done:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
