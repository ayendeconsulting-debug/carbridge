/*
  Warnings:

  - A unique constraint covering the columns `[offerId]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "offerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_offerId_key" ON "Reservation"("offerId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
