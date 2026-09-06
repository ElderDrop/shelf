import { z } from "zod";

/** Opaque share token from URL path (raw, not hash). */
export const shareTokenSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid share token");

export type ShareTokenInput = z.infer<typeof shareTokenSchema>;
