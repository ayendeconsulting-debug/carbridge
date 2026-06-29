/*
  Warnings:

  - A unique constraint covering the columns `[invoiceId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('CAR', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PART_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('CARBRIDGE', 'PLATFORM', 'WEBHOOK');

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "invoiceId" TEXT,
ALTER COLUMN "providerRef" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "colour" TEXT,
ADD COLUMN     "fuelType" "FuelType",
ADD COLUMN     "transmission" "Transmission";

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "offerId" TEXT,
    "reservationId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "fxRate" DECIMAL(18,6) NOT NULL,
    "totalCAD" DECIMAL(14,2) NOT NULL,
    "totalNGN" DECIMAL(18,2) NOT NULL,
    "externalQuoteId" TEXT,
    "externalNumber" TEXT,
    "externalUrl" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "quotationId" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "amount" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bankInstructions" JSONB,
    "externalInvoiceId" TEXT,
    "externalNumber" TEXT,
    "externalUrl" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "source" "PaymentSource" NOT NULL,
    "externalPaymentId" TEXT,
    "recordedById" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quotation_vehicleId_idx" ON "Quotation"("vehicleId");

-- CreateIndex
CREATE INDEX "Quotation_userId_idx" ON "Quotation"("userId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_externalQuoteId_idx" ON "Quotation"("externalQuoteId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_kind_idx" ON "Invoice"("kind");

-- CreateIndex
CREATE INDEX "Invoice_externalInvoiceId_idx" ON "Invoice"("externalInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_invoiceId_key" ON "Subscription"("invoiceId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
