-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "invoiceNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoiceNumber_key" ON "orders"("invoiceNumber");
