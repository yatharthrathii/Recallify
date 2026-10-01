-- When a card's text last changed, separately from updatedAt, which every
-- review bumps. Existing cards take their creation time: nothing is known
-- about earlier edits, and a copy compares against this, so the earliest
-- honest value is the one that causes no spurious sync.
ALTER TABLE "cards" ADD COLUMN "textUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "cards" SET "textUpdatedAt" = "createdAt";

-- One copy per source card per deck, so two syncs racing cannot add a card twice.
DROP INDEX "cards_deckId_sourceCardId_idx";
CREATE UNIQUE INDEX "cards_deckId_sourceCardId_key" ON "cards"("deckId", "sourceCardId");

-- Postgres does not index a foreign key column by itself.
CREATE INDEX "decks_sourceDeckId_idx" ON "decks"("sourceDeckId");

-- A deck flagged public before publishing dates existed gets one.
UPDATE "decks" SET "publishedAt" = "createdAt" WHERE "isPublic" = true AND "publishedAt" IS NULL;
