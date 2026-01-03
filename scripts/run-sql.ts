import fs from "fs";
import pg from "pg";

async function main() {
  // Lightweight .env loader to avoid external dependency
  const envPath = ".env";
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      const value = rest.join("=");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/run-sql.ts <sql-file-path>");
    process.exit(1);
  }

  const { Client } = pg;
  const sql = fs.readFileSync(filePath, "utf8");
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Applied SQL from ${filePath}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to apply SQL", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
