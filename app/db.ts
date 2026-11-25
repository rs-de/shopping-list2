import * as fs from "node:fs"
import * as path from "node:path"
import * as url from "node:url"
import { column as c, sql, table } from "remix/data-table"
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

// Checked before opening, which creates the file: a brand-new database has
// nothing worth backing up.
const existedAtStart = fs.existsSync(filename)

export const db = createSqliteDatabase({ filename })

// Snapshots the database next to itself before pending migrations run, e.g.
// `prod.db.before-0002_add_x.bak` — one file per migration, so the set is
// naturally bounded and each name says which change it predates. An existing
// snapshot is kept, not overwritten: after a crashed migration and restart,
// it still holds the state from before the first attempt.
export async function migrate() {
	const migrations = await loadMigrations(MIGRATIONS_DIR)
	const pending = (await db.migrationStatus(migrations)).filter(
		(m) => m.status === "pending",
	)
	if (pending.length === 0) return
	if (existedAtStart) {
		const backup = `${filename}.before-${pending[0].id}_${pending[0].name}.bak`
		if (!fs.existsSync(backup)) {
			// VACUUM INTO writes a consistent copy even of an open database.
			await db.exec(sql`VACUUM INTO ${backup}`)
			console.log(`Backed up database to ${backup}`)
		}
	}
	await db.migrate(migrations)
}
