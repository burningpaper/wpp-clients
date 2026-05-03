import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", [
  "account_director",
  "ceo_md",
  "system_admin",
]);

export const relationshipStrengthEnum = pgEnum("relationship_strength", [
  "cold",
  "warm",
  "strong",
]);

export const noteTypeEnum = pgEnum("note_type", [
  "meeting",
  "news",
  "budget_signal",
  "relationship",
  "risk",
]);

export const visibilityEnum = pgEnum("visibility", ["wpp_sa", "agency_only"]);

// ---------------------------------------------------------------------------
// tsvector custom type (Drizzle doesn't ship one)
// ---------------------------------------------------------------------------

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name"),
    agencyId: uuid("agency_id").references(() => agencies.id),
    role: roleEnum("role").notNull().default("account_director"),
    isChampion: boolean("is_champion").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id),
  title: text("title"),
  email: text("email"),
  // Kept current by a DB trigger on any write to contacts or contact_agency_relationships
  lastUpdated: timestamp("last_updated", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contactAgencyRelationships = pgTable(
  "contact_agency_relationships",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    relationshipStrength:
      relationshipStrengthEnum("relationship_strength").notNull(),
    lastContactDate: timestamp("last_contact_date", { withTimezone: true }),
    relationshipOwnerId: uuid("relationship_owner_id").references(
      () => users.id
    ),
  },
  (t) => [
    primaryKey({ columns: [t.contactId, t.agencyId] }),
    index("car_agency_strength_idx").on(t.agencyId, t.relationshipStrength),
  ]
);

export const intelligenceNotes = pgTable(
  "intelligence_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    orgId: uuid("org_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    noteType: noteTypeEnum("note_type").notNull(),
    body: text("body").notNull(),
    // Generated stored tsvector — created via raw SQL in migration (Drizzle doesn't support GENERATED for tsvector)
    bodyTsv: tsvector("body_tsv"),
    visibility: visibilityEnum("visibility").notNull().default("wpp_sa"),
    createdByAgencyId: uuid("created_by_agency_id")
      .notNull()
      .references(() => agencies.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notes_body_fts_idx").using("gin", t.bodyTsv),
    index("notes_contact_idx").on(t.contactId),
    index("notes_org_idx").on(t.orgId),
  ]
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] })]
);

export const orgTags = pgTable(
  "org_tags",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.tagId] })]
);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type Agency = typeof agencies.$inferSelect;
export type User = typeof users.$inferSelect;
export type Organisation = typeof organisations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type ContactAgencyRelationship =
  typeof contactAgencyRelationships.$inferSelect;
export type IntelligenceNote = typeof intelligenceNotes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
