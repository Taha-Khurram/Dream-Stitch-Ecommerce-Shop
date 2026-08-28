import { z } from "zod";

export const createTodoSchema = z.object({
  title: z
    .string({
      required_error: "Title is required",
    })
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title cannot exceed 255 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .nullable(),
  is_completed: z.boolean().optional().default(false),
});

export const updateTodoSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(255, "Title cannot exceed 255 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional()
      .nullable(),
    is_completed: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.is_completed !== undefined,
    {
      message: "At least one field (title, description, or is_completed) must be provided for update",
    }
  );

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
