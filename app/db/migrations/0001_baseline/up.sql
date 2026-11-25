-- Baseline taken over from Prisma (prisma/migrations/20260621161818_init).
-- Existing databases already have the table, so this is a no-op there.
CREATE TABLE IF NOT EXISTS "ShoppingList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articles" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Prisma stored ISO strings ('2026-08-02T20:27:18.698+00:00'); data-table
-- writes SQLite's format ('2026-08-02 20:27:18.698'). Normalize so string
-- comparisons (the 90-day cleanup) order correctly.
UPDATE "ShoppingList"
SET "createdAt" = strftime('%Y-%m-%d %H:%M:%f', "createdAt"),
    "updatedAt" = strftime('%Y-%m-%d %H:%M:%f', "updatedAt")
WHERE "createdAt" LIKE '%T%' OR "updatedAt" LIKE '%T%';

DROP TABLE IF EXISTS "_prisma_migrations";
