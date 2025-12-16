import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  contactIds: jsonb("contact_ids").$type<string[]>().notNull().default([]),
  schedules: jsonb("schedules").$type<Schedule[]>().notNull().default([]),
  backgroundInfo: text("background_info").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const insertGroupSchema = createInsertSchema(groups).pick({
  name: true,
  description: true,
  contactIds: true,
  schedules: true,
  backgroundInfo: true,
  enabled: true,
});

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

// Import Schedule type for jsonb typing
interface Schedule {
  id: string;
  type: 'one-time' | 'recurring';
  name?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  frequency?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    monthsOfYear?: number[];
  };
  exceptions?: string[];
  enabled: boolean;
}
