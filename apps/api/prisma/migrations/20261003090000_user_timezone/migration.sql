-- The zone an account's days are counted in. Null is UTC, which is what
-- every existing account was counted in until now, so nothing moves.
ALTER TABLE "users" ADD COLUMN "timezone" TEXT;
