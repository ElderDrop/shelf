import { z } from "zod";

export const listTypeSchema = z.enum(["library", "wishlist"]);

export const assignmentCreateSchema = z.object({
  catalog_item_id: z.uuid(),
  list_type: listTypeSchema,
});

export const assignmentUpdateSchema = z.object({
  list_type: listTypeSchema,
});

export const assignmentListFilterSchema = listTypeSchema;

export const assignmentIdSchema = z.uuid();

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
