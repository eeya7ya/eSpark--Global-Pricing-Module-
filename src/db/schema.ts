import {
  pgTable,
  serial,
  text,
  numeric,
  integer,
  timestamp,
  unique,
  boolean,
} from "drizzle-orm/pg-core";

export const manufacturers = pgTable("manufacturers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Visual accent color key (e.g. "cyan", "blue", "purple"). See
  // src/lib/manufacturerColors.ts for the palette. Nullable so legacy
  // rows fall back to the default accent.
  color: text("color"),
  // Optional short label ("Customer A", "Site 2"…) used to disambiguate
  // manufacturers that share a brand name.
  tag: text("tag"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  createdByUserId: integer("created_by_user_id"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Short human-friendly login handle ("admin", "raghad"...). This app
  // is intentionally username-only — no email field.
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  // The user's permanent accent color — applies to all their manufacturers.
  // Matches keys in src/lib/manufacturerColors.ts.
  color: text("color").notNull().default("cyan"),
  manufacturerId: integer("manufacturer_id").references(
    () => manufacturers.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date"),
  // Free-text name of the person responsible for this project — shown
  // beside the project name so users can quickly identify ownership and
  // avoid working on the wrong project by mistake.
  responsiblePerson: text("responsible_person"),
  manufacturerId: integer("manufacturer_id")
    .references(() => manufacturers.id, { onDelete: "cascade" })
    .notNull(),
  // Owner: non-admins only see their own projects; admin sees all.
  // Nullable for backwards compatibility with legacy rows.
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const projectConstants = pgTable("project_constants", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  currencyRate: numeric("currency_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.710000"),
  shippingRate: numeric("shipping_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.150000"),
  customsRate: numeric("customs_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.120000"),
  profitMargin: numeric("profit_margin", { precision: 10, scale: 6 })
    .notNull()
    .default("0.250000"),
  taxRate: numeric("tax_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.160000"),
  targetCurrency: text("target_currency").notNull().default("JOD"),
  sourceCurrency: text("source_currency").notNull().default("USD"),
});

export const accountRequests = pgTable("account_requests", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id"),
  // DB column is still "actor_email" for historical reasons; exposed
  // as actorUsername at the TS level.
  actorUsername: text("actor_email"),
  actorName: text("actor_name"),
  action: text("action").notNull(), // e.g. "login", "login_failed", "logout", "create", "update", "delete"
  entityType: text("entity_type"), // e.g. "manufacturer", "project", "user"
  entityId: integer("entity_id"),
  details: text("details"), // JSON stringified context
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Per-user customisation of a manufacturer: color and tag are owned by
// the user, not the brand. One row per (user, manufacturer) pair.
export const userManufacturers = pgTable(
  "user_manufacturers",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    manufacturerId: integer("manufacturer_id")
      .references(() => manufacturers.id, { onDelete: "cascade" })
      .notNull(),
    color: text("color").notNull().default("cyan"),
    tag: text("tag").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [unique().on(t.userId, t.manufacturerId)]
);

export const productLines = pgTable(
  "product_lines",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").notNull(),
    itemModel: text("item_model").notNull().default(""),
    priceUsd: numeric("price_usd", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    quantity: integer("quantity").notNull().default(1),
    shippingOverride: numeric("shipping_override", { precision: 12, scale: 4 }),
    customsOverride: numeric("customs_override", { precision: 12, scale: 4 }),
    // Per-row rate overrides (decimal, e.g. 0.15 = 15%). When set, they
    // take precedence over the global project constants for this row only.
    shippingRateOverride: numeric("shipping_rate_override", { precision: 10, scale: 6 }),
    customsRateOverride: numeric("customs_rate_override", { precision: 10, scale: 6 }),
    profitRateOverride: numeric("profit_rate_override", { precision: 10, scale: 6 }),
  },
  (t) => [unique().on(t.projectId, t.position)]
);

export type UserManufacturer = typeof userManufacturers.$inferSelect;
export type NewUserManufacturer = typeof userManufacturers.$inferInsert;
export type Manufacturer = typeof manufacturers.$inferSelect;
export type NewManufacturer = typeof manufacturers.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectConstants = typeof projectConstants.$inferSelect;
export type ProductLine = typeof productLines.$inferSelect;
export type AccountRequest = typeof accountRequests.$inferSelect;
export type NewAccountRequest = typeof accountRequests.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
