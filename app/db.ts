import * as path from "node:path"
import * as url from "node:url"
import { column as c, table } from "remix/data-table"
import { loadMigrations } from "remix/data-table/migrations/node"
import { createSqliteDatabase } from "remix/data-table/sqlite"

const MIGRATIONS_DIR = path.join(
	path.dirname(url.fileURLToPath(import.meta.url)),
	"db/migrations",
)

// Table and column names keep the casing Prisma created them with, so the
// existing production database is used as-is (see the baseline migration).
export const shoppingLists = table({
	name: "ShoppingList",
	columns: {
		id: c.text().primaryKey(),
		articles: c.json(),
		createdAt: c.timestamp(),
		updatedAt: c.timestamp(),
	},
	timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
})

// DATABASE_URL keeps its Prisma-era `file:<path>` form so fly.toml and
// existing .env files stay valid.
const filename = (process.env.DATABASE_URL ?? "file:./dev.db").replace(
	/^file:/,
	"",
)

export const db = createSqliteDatabase({ filename })

export async function migrate() {
	await db.migrate(await loadMigrations(MIGRATIONS_DIR))
}
