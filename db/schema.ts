import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums — existing
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
// Enums — Stream event
// ---------------------------------------------------------------------------

export const contactCategoryEnum = pgEnum("contact_category", [
  "client_sa",
  "client_africa",
  "client_global",
  "industry_sa",
  "industry_africa",
  "industry_global",
  "agency_sa",
  "agency_africa",
  "agency_global",
  "rising_star",
]);

export const genderEnum = pgEnum("gender", ["male", "female", "unknown"]);

export const raceEnum = pgEnum("race", [
  "african",
  "coloured",
  "indian",
  "white",
  "other",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "first_round_invite",
  "second_round_invite",
  "third_round_invite",
  "agency_invite",
  "rising_star_invite",
  "waiting_list",
  "other_invite",
  "no",
]);

export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "pending",
  "bounced",
  "error",
  "accepted",
  "declined",
  "cancelled",
  "no_show",
  "accepted_on_their_behalf",
]);

export const priorityFlagEnum = pgEnum("priority_flag", ["yes", "other"]);

// Generic event management enums
export const eventInviteStatusEnum = pgEnum("event_invite_status", [
  "not_invited",
  "invited",
  "waitlisted",
  "declined",
]);

export const eventRsvpStatusEnum = pgEnum("event_rsvp_status", [
  "pending",
  "confirmed",
  "declined",
  "attended",
  "no_show",
]);

// ---------------------------------------------------------------------------
// Custom column types
// ---------------------------------------------------------------------------

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

// ---------------------------------------------------------------------------
// Tables — existing
// ---------------------------------------------------------------------------

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
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
// Tables — Stream event
// ---------------------------------------------------------------------------

export const streamContacts = pgTable(
  "stream_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: contactCategoryEnum("category").notNull(),
    company: text("company"),
    position: text("position"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    city: text("city"),
    country: text("country"),
    gender: genderEnum("gender"),
    race: raceEnum("race"),
    // Uniqueness enforced by partial index in migration (email IS NOT NULL AND deleted_at IS NULL)
    email: citext("email"),
    assistantEmail: citext("assistant_email"),
    mobileNumber: text("mobile_number"),
    linkedinUrl: text("linkedin_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("stream_contacts_category_idx").on(t.category),
    index("stream_contacts_name_idx").on(t.lastName, t.firstName),
  ]
);

export const eventYears = pgTable("event_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  year: integer("year").notNull().unique(),
  // Partial unique index (only one row with is_current=true) is enforced in migration SQL
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eventYearParticipations = pgTable(
  "event_year_participations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => streamContacts.id, { onDelete: "cascade" }),
    eventYearId: uuid("event_year_id")
      .notNull()
      .references(() => eventYears.id, { onDelete: "restrict" }),
    nominated: boolean("nominated").notNull().default(false),
    priority: priorityFlagEnum("priority"),
    nominatingAgencyId: uuid("nominating_agency_id").references(
      () => agencies.id
    ),
    nominator: text("nominator"),
    inviteStatus: inviteStatusEnum("invite_status"),
    rsvpStatus: rsvpStatusEnum("rsvp_status"),
    comments: text("comments"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("participation_unique_per_year").on(
      t.contactId,
      t.eventYearId
    ),
    index("participations_year_idx").on(t.eventYearId),
    index("participations_contact_idx").on(t.contactId),
    index("participations_invite_status_idx").on(
      t.eventYearId,
      t.inviteStatus
    ),
    index("participations_rsvp_status_idx").on(t.eventYearId, t.rsvpStatus),
  ]
);

// ---------------------------------------------------------------------------
// Tables — generic events
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    venue: text("venue"),
    eventDate: date("event_date"),
    capacity: integer("capacity"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("events_date_idx").on(t.eventDate)]
);

export const eventInvitees = pgTable(
  "event_invitees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    inviteStatus: eventInviteStatusEnum("invite_status")
      .notNull()
      .default("not_invited"),
    rsvpStatus: eventRsvpStatusEnum("rsvp_status").notNull().default("pending"),
    notes: text("notes"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("event_invitees_unique").on(t.eventId, t.contactId),
    index("event_invitees_event_idx").on(t.eventId),
    index("event_invitees_contact_idx").on(t.contactId),
  ]
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
export type StreamContact = typeof streamContacts.$inferSelect;
export type EventYear = typeof eventYears.$inferSelect;
export type EventYearParticipation =
  typeof eventYearParticipations.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventInvitee = typeof eventInvitees.$inferSelect;
