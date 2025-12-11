import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Name is required"),
});

export const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(5, "Phone is required"),
  notes: z.string().optional(),
});

export const groupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().min(5, "Description is required"),
  backgroundInfo: z.string().min(10, "Background info is required for AI context"),
});
