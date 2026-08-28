import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().uuid({ message: "Invalid product ID format (must be a valid UUID)" }),
  quantity: z
    .number()
    .int({ message: "Quantity must be an integer" })
    .min(1, { message: "Quantity must be at least 1" })
    .max(100, { message: "Cannot order more than 100 of a single item at once" }),
});

export const shippingAddressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Full name must be at least 2 characters" })
    .max(100, { message: "Full name cannot exceed 100 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address format" }),
  streetAddress: z
    .string()
    .trim()
    .min(5, { message: "Street address must be at least 5 characters" })
    .max(200, { message: "Street address cannot exceed 200 characters" }),
  city: z
    .string()
    .trim()
    .min(2, { message: "City must be at least 2 characters" })
    .max(100, { message: "City cannot exceed 100 characters" }),
  state: z
    .string()
    .trim()
    .min(2, { message: "State/Province must be at least 2 characters" })
    .max(100, { message: "State/Province cannot exceed 100 characters" }),
  postalCode: z
    .string()
    .trim()
    .min(3, { message: "Postal code must be at least 3 characters" })
    .max(20, { message: "Postal code cannot exceed 20 characters" }),
  country: z
    .string()
    .trim()
    .min(2, { message: "Country must be at least 2 characters" })
    .max(100, { message: "Country cannot exceed 100 characters" }),
  phone: z
    .string()
    .trim()
    .max(30, { message: "Phone number cannot exceed 30 characters" })
    .optional()
    .or(z.literal("")),
});

export const checkoutPayloadSchema = z.object({
  items: z
    .array(cartItemSchema)
    .min(1, { message: "Your cart must contain at least one item to checkout" }),
  shippingAddress: shippingAddressSchema,
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CheckoutPayloadInput = z.infer<typeof checkoutPayloadSchema>;
