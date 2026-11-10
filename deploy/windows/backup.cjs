// Backs up the database and the pictures. Run it by hand (node deploy\windows\backup.cjs) or let the nightly task do it.
//
// It makes a folder named with today's date (for example 2026-11-10) holding:
//   app.db   a safe copy of the database (made while the app is running, so nothing is half written)
//   uploads  all the pictures
// and keeps the last 14 days. Where the backups go is set in .env.local:
//   BACKUP_DIR=D:\OrderManagerBackups     (default: the "backups" folder inside the project)
//   BACKUP_DIR_2=\\NAS\backups            (optional: a second place, for example a USB drive or a network folder)
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

// read .env.local the simple way (the app itself reads it too)
const env = { ...process.env };
try {
  for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  /* no .env.local: use the defaults */
}

const dbFile = path.resolve(root, env.DATABASE_URL || "./data/app.db");
const uploads = path.resolve(root, env.UPLOAD_DIR || "./data/uploads");
const places = [env.BACKUP_DIR || path.join(root, "backups"), env.BACKUP_DIR_2].filter(Boolean).map((p) => path.resolve(root, p));
const KEEP_DAYS = 14;

const Database = require(path.join(root, "node_modules", "better-sqlite3"));

async function main() {
  const day = new Date().toISOString().slice(0, 10);
  const first = path.join(places[0], day);
  fs.mkdirSync(first, { recursive: true });

  const db = new Database(dbFile, { readonly: true, fileMustExist: true });
  await db.backup(path.join(first, "app.db"));
  db.close();
  if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(first, "uploads"), { recursive: true, force: true });

  // the same backup in the other places
  for (const extra of places.slice(1)) {
    const to = path.join(extra, day);
    fs.mkdirSync(to, { recursive: true });
    fs.cpSync(first, to, { recursive: true, force: true });
  }

  // keep only the last KEEP_DAYS dated folders in each place
  for (const place of places) {
    const old = fs
      .readdirSync(place)
      .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
      .sort()
      .slice(0, -KEEP_DAYS);
    for (const n of old) fs.rmSync(path.join(place, n), { recursive: true, force: true });
  }

  const size = fs.statSync(path.join(first, "app.db")).size;
  console.log(`Backup done: ${first} (database ${Math.round(size / 1024)} KB, pictures copied). Places: ${places.join(", ")}`);
}

main().catch((e) => {
  console.error("Backup FAILED:", e.message);
  process.exit(1);
});
