import { z } from "zod";

export const catalogStatusFilterSchema = z.enum(["pending", "approved", "rejected"]);

export const catalogCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .max(5000)
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(20)
    .default([])
    .refine((tags) => new Set(tags).size === tags.length, {
      message: "tags must be unique",
    }),
});

export const catalogUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z
      .string()
      .max(5000)
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
      }),
    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .optional()
      .refine((tags) => tags === undefined || new Set(tags).size === tags.length, {
        message: "tags must be unique",
      }),
    status: z.enum(["approved", "rejected"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const catalogItemIdSchema = z.uuid();

export type CatalogCreateInput = z.infer<typeof catalogCreateSchema>;
export type CatalogUpdateInput = z.infer<typeof catalogUpdateSchema>;
