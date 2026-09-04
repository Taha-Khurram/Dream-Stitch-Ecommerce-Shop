import { z } from "zod";
import { CUSTOM_SIZE_LABEL, CUSTOM_SIZE_LIMITS } from "@/lib/custom-size";

/**
 * Made-to-measure dimensions. The bounds are the ones in `lib/custom-size.ts`,
 * applied again here because a payload does not have to have come from our own
 * form — and a measurement is what someone cuts fabric against.
 */
export const customSizeSchema = z
  .object({
    width: z.number().positive({ message: "Width must be greater than zero" }),
    height: z.number().positive({ message: "Height must be greater than zero" }),
    unit: z.enum(["in", "cm"], { message: "Unit must be 'in' or 'cm'" }),
  })
  .refine(
    ({ width, height, unit }) => {
      const { min, max } = CUSTOM_SIZE_LIMITS[unit];
      return width >= min && width <= max && height >= min && height <= max;
    },
    { message: "Measurements are outside the range we can cut" }
  );

export const cartItemSchema = z
  .object({
    productId: z.string().uuid({ message: "Invalid product ID format (must be a valid UUID)" }),
    quantity: z
      .number()
      .int({ message: "Quantity must be an integer" })
      .min(1, { message: "Quantity must be at least 1" })
      .max(100, { message: "Cannot order more than 100 of a single item at once" }),
    /** Bed size, or `CUSTOM_SIZE_LABEL` for a line cut to measurement. */
    size: z.string().trim().max(60).nullish(),
    custom: customSizeSchema.nullish(),
  })
  /* A custom line without numbers is an order nobody can fill, and numbers on
     a stocked size are numbers nobody will read. Reject both here rather than
     letting a half-formed variant reach `order_items`. */
  .refine((item) => item.size !== CUSTOM_SIZE_LABEL || Boolean(item.custom), {
    message: "A custom-size line must carry its measurements",
    path: ["custom"],
  })
  .refine((item) => !item.custom || item.size === CUSTOM_SIZE_LABEL, {
    message: `Measurements are only valid on a "${CUSTOM_SIZE_LABEL}" line`,
    path: ["size"],
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
export type CustomSizeInput = z.infer<typeof customSizeSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CheckoutPayloadInput = z.infer<typeof checkoutPayloadSchema>;
