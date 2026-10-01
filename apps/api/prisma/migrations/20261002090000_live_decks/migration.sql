-- CreateEnum
CREATE TYPE "DeckChangeKind" AS ENUM ('ADDED', 'EDITED', 'REMOVED', 'NOTE');

-- AlterEnum
ALTER TYPE "CardSource" ADD VALUE 'SUBSCRIPTION';

-- AlterTable
ALTER TABLE "decks" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "sourceDeckId" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "sourceCardId" TEXT,
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "deck_changes" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "kind" "DeckChangeKind" NOT NULL,
    "cardId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deck_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deck_changes_deckId_createdAt_idx" ON "deck_changes"("deckId", "createdAt");

-- CreateIndex
CREATE INDEX "decks_isPublic_publishedAt_idx" ON "decks"("isPublic", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "decks_userId_sourceDeckId_key" ON "decks"("userId", "sourceDeckId");

-- CreateIndex
CREATE INDEX "cards_deckId_sourceCardId_idx" ON "cards"("deckId", "sourceCardId");

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_sourceDeckId_fkey" FOREIGN KEY ("sourceDeckId") REFERENCES "decks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_changes" ADD CONSTRAINT "deck_changes_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

