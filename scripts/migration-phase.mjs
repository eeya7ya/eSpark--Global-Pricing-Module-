// Single-phase helper. Invoked as a subprocess so each phase gets a
// fresh module graph (the db.ts module caches its connection in a
// closure and can only point at one DATABASE_URL at a time).
//
// Usage:
//   node --import tsx scripts/migration-phase.mjs seed <url>
//   node --import tsx scripts/migration-phase.mjs export <url> <outfile>
//   node --import tsx scripts/migration-phase.mjs ensure <url>
//   node --import tsx scripts/migration-phase.mjs verify-empty <url>
//   node --import tsx scripts/migration-phase.mjs import <url> <infile>
//   node --import tsx scripts/migration-phase.mjs verify <url> <expected.json>

import fs from "node:fs/promises";

const [, , phase, url, extra] = process.argv;
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = "test-secret-123456";

const { ensureSchema, ensureAdminUser } = await import(
  "../src/lib/ensureSchema.ts"
);
const schema = await import("../src/db/schema.ts");
const { db } = await import("../src/lib/db.ts");
const { sql } = await import("drizzle-orm");

const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

async function seed() {
  await ensureSchema();
  await ensureAdminUser();

  const [mfg] = await db
    .insert(schema.manufacturers)
    .values({ name: "Acme Factory", color: "cyan", tag: "Primary" })
    .returning();

  const [usr] = await db
    .insert(schema.users)
    .values({
      username: "alice",
      passwordHash: "$2a$12$fakehashfakehashfakehashfakehashfakehashfakehashfak",
      fullName: "Alice Example",
      role: "user",
      color: "purple",
      manufacturerId: mfg.id,
    })
    .returning();

  const [proj] = await db
    .insert(schema.projects)
    .values({
      name: "Spring Catalog 2026",
      date: "2026-04-15",
      responsiblePerson: "Alice",
      manufacturerId: mfg.id,
      userId: usr.id,
    })
    .returning();

  await db.insert(schema.projectConstants).values({
    projectId: proj.id,
    currencyRate: "0.710000",
    shippingRate: "0.150000",
    customsRate: "0.120000",
    profitMargin: "0.250000",
    taxRate: "0.160000",
    targetCurrency: "JOD",
    sourceCurrency: "USD",
  });

  await db.insert(schema.productLines).values([
    {
      projectId: proj.id,
      position: 1,
      itemModel: "WIDGET-100",
      priceUsd: "42.5000",
      quantity: 10,
    },
    {
      projectId: proj.id,
      position: 2,
      itemModel: "WIDGET-200",
      priceUsd: "99.9500",
      quantity: 3,
    },
  ]);

  console.log("seed ok");
}

async function exportFn(outfile) {
  const data = await Promise.all([
    db.select().from(schema.manufacturers),
    db.select().from(schema.users),
    db.select().from(schema.userManufacturers),
    db.select().from(schema.projects),
    db.select().from(schema.projectConstants),
    db.select().from(schema.productLines),
    db.select().from(schema.accountRequests),
    db.select().from(schema.auditLogs),
  ]);
  const payload = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      manufacturers: data[0],
      users: data[1],
      userManufacturers: data[2],
      projects: data[3],
      projectConstants: data[4],
      productLines: data[5],
      accountRequests: data[6],
      auditLogs: data[7],
    },
  };
  await fs.writeFile(outfile, JSON.stringify(payload, null, 2));
  console.log(
    "export ok",
    Object.fromEntries(
      Object.entries(payload.tables).map(([k, v]) => [k, v.length])
    )
  );
}

async function ensure() {
  await ensureSchema();
  await ensureAdminUser();
  console.log("ensure ok");
}

async function verifyEmpty() {
  const mfg = await db.select().from(schema.manufacturers);
  const proj = await db.select().from(schema.projects);
  const nonAdmin = await db
    .select()
    .from(schema.users)
    .where(sql`username <> 'admin'`);
  if (mfg.length || proj.length || nonAdmin.length) {
    throw new Error(
      `not empty: mfg=${mfg.length} proj=${proj.length} nonAdmin=${nonAdmin.length}`
    );
  }
  console.log("verify-empty ok (only seeded admin present)");
}

async function importFn(infile) {
  const payload = JSON.parse(await fs.readFile(infile, "utf8"));
  const t = payload.tables;

  await db.execute(sql`DELETE FROM users WHERE username = 'admin'`);

  const insertChunked = async (table, rows, CHUNK = 500) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.insert(table).values(rows.slice(i, i + CHUNK));
    }
  };

  if (t.manufacturers.length)
    await insertChunked(
      schema.manufacturers,
      t.manufacturers.map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color ?? null,
        tag: m.tag ?? null,
        createdAt: toDate(m.createdAt) ?? new Date(),
        deletedAt: toDate(m.deletedAt),
        createdByUserId: m.createdByUserId ?? null,
      }))
    );

  if (t.users.length)
    await insertChunked(
      schema.users,
      t.users.map((u) => ({
        id: u.id,
        username: u.username,
        passwordHash: u.passwordHash,
        fullName: u.fullName,
        role: u.role,
        color: u.color,
        manufacturerId: u.manufacturerId ?? null,
        createdAt: toDate(u.createdAt) ?? new Date(),
      }))
    );

  if (t.userManufacturers.length)
    await insertChunked(
      schema.userManufacturers,
      t.userManufacturers.map((x) => ({
        id: x.id,
        userId: x.userId,
        manufacturerId: x.manufacturerId,
        color: x.color,
        tag: x.tag,
        createdAt: toDate(x.createdAt) ?? new Date(),
        deletedAt: toDate(x.deletedAt),
      }))
    );

  if (t.projects.length)
    await insertChunked(
      schema.projects,
      t.projects.map((p) => ({
        id: p.id,
        name: p.name,
        date: p.date ?? null,
        responsiblePerson: p.responsiblePerson ?? null,
        manufacturerId: p.manufacturerId,
        userId: p.userId ?? null,
        createdAt: toDate(p.createdAt) ?? new Date(),
        deletedAt: toDate(p.deletedAt),
      }))
    );

  if (t.projectConstants.length)
    await insertChunked(
      schema.projectConstants,
      t.projectConstants.map((c) => ({
        id: c.id,
        projectId: c.projectId,
        currencyRate: String(c.currencyRate),
        shippingRate: String(c.shippingRate),
        customsRate: String(c.customsRate),
        profitMargin: String(c.profitMargin),
        taxRate: String(c.taxRate),
        targetCurrency: c.targetCurrency,
        sourceCurrency: c.sourceCurrency,
      }))
    );

  if (t.productLines.length)
    await insertChunked(
      schema.productLines,
      t.productLines.map((l) => ({
        id: l.id,
        projectId: l.projectId,
        position: l.position,
        itemModel: l.itemModel,
        priceUsd: String(l.priceUsd),
        quantity: l.quantity,
        shippingOverride:
          l.shippingOverride != null ? String(l.shippingOverride) : null,
        customsOverride:
          l.customsOverride != null ? String(l.customsOverride) : null,
        shippingRateOverride:
          l.shippingRateOverride != null ? String(l.shippingRateOverride) : null,
        customsRateOverride:
          l.customsRateOverride != null ? String(l.customsRateOverride) : null,
        profitRateOverride:
          l.profitRateOverride != null ? String(l.profitRateOverride) : null,
      }))
    );

  if (t.accountRequests.length)
    await insertChunked(
      schema.accountRequests,
      t.accountRequests.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        company: r.company,
        message: r.message,
        status: r.status,
        createdAt: toDate(r.createdAt) ?? new Date(),
      }))
    );

  if (t.auditLogs.length)
    await insertChunked(
      schema.auditLogs,
      t.auditLogs.map((l) => ({
        id: l.id,
        actorUserId: l.actorUserId ?? null,
        actorUsername: l.actorUsername ?? null,
        actorName: l.actorName ?? null,
        action: l.action,
        entityType: l.entityType ?? null,
        entityId: l.entityId ?? null,
        details: l.details ?? null,
        ipAddress: l.ipAddress ?? null,
        createdAt: toDate(l.createdAt) ?? new Date(),
      }))
    );

  const tables = [
    "manufacturers",
    "users",
    "user_manufacturers",
    "projects",
    "project_constants",
    "product_lines",
    "account_requests",
    "audit_logs",
  ];
  for (const tbl of tables) {
    await db.execute(
      sql.raw(
        `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), ` +
          `GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${tbl}), 1), true)`
      )
    );
  }
  console.log("import ok");
}

async function verify(expectedFile) {
  const expected = JSON.parse(await fs.readFile(expectedFile, "utf8"));

  const dstMfg = await db.select().from(schema.manufacturers);
  const dstUsers = await db.select().from(schema.users);
  const dstProj = await db.select().from(schema.projects);
  const dstLines = await db.select().from(schema.productLines);
  const dstConst = await db.select().from(schema.projectConstants);

  if (dstMfg.length !== expected.tables.manufacturers.length)
    throw new Error(
      `manufacturers: expected ${expected.tables.manufacturers.length} got ${dstMfg.length}`
    );
  if (dstUsers.length !== expected.tables.users.length)
    throw new Error(
      `users: expected ${expected.tables.users.length} got ${dstUsers.length}`
    );
  if (dstProj.length !== expected.tables.projects.length)
    throw new Error(
      `projects: expected ${expected.tables.projects.length} got ${dstProj.length}`
    );
  if (dstLines.length !== expected.tables.productLines.length)
    throw new Error(
      `productLines: expected ${expected.tables.productLines.length} got ${dstLines.length}`
    );

  const widget100 = dstLines.find((l) => l.itemModel === "WIDGET-100");
  if (!widget100 || Number(widget100.priceUsd) !== 42.5) {
    throw new Error(`WIDGET-100 price lost: ${widget100?.priceUsd}`);
  }

  const alice = dstUsers.find((u) => u.username === "alice");
  if (!alice || alice.role !== "user" || alice.color !== "purple") {
    throw new Error(`alice data mangled`);
  }

  // Sequence bump: next insert should get id > max existing.
  const maxMfgId = Math.max(...dstMfg.map((m) => m.id));
  const [newMfg] = await db
    .insert(schema.manufacturers)
    .values({ name: "Post-restore manufacturer" })
    .returning();
  if (newMfg.id <= maxMfgId) {
    throw new Error(
      `sequence not bumped: new id ${newMfg.id} <= max existing ${maxMfgId}`
    );
  }
  console.log(
    `verify ok — sequence bumped (new id ${newMfg.id} > max imported ${maxMfgId})`
  );
}

try {
  switch (phase) {
    case "seed":
      await seed();
      break;
    case "export":
      await exportFn(extra);
      break;
    case "ensure":
      await ensure();
      break;
    case "verify-empty":
      await verifyEmpty();
      break;
    case "import":
      await importFn(extra);
      break;
    case "verify":
      await verify(extra);
      break;
    default:
      throw new Error(`unknown phase ${phase}`);
  }
  process.exit(0);
} catch (e) {
  console.error("PHASE FAIL", phase, e);
  process.exit(1);
}
