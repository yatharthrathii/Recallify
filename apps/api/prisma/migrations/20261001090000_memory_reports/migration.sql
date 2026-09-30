-- CreateTable
CREATE TABLE "memory_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memory_reports_userId_createdAt_idx" ON "memory_reports"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "memory_reports" ADD CONSTRAINT "memory_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

