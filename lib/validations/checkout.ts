import { z } from "zod";
import { CUSTOM_SIZE_LABEL, CUSTOM_SIZE_LIMITS } from "@/lib/custom-size";
import { CODE_PATTERN } from "@/lib/discounts/lifecycle";
import {
  AVAILABLE_METHODS,
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_COPY,
  isAvailableMethod,
} from "@/lib/orders/payment";

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

/**
 * A discount code as the storefront sends it: upper-cased before it is
 * checked, so `summer24` and `SUMMER24` are the same code here as they are in
 * Postgres. `CODE_PATTERN` is the same shape the CHECK on `discount_codes.code`
 * enforces — see lib/discounts/lifecycle.ts.
 *
 * Rejecting the shape before the round trip is not about security (the
 * database decides whether a code exists, and it is the only thing that can)
 * but about honesty: a code with a space in it was mistyped, and saying so
 * immediately beats a trip to Postgres to be told it does not exist.
 */
export const discountCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => CODE_PATTERN.test(value), {
    message: "That does not look like a discount code",
  });

/**
 * The same, where leaving the field blank is the normal case.
 *
 * The empty string has to become `undefined` before the shape check runs —
 * most orders carry no code, and a checkout should not fail validation because
 * a field nobody filled in is empty.
 */
export const optionalDiscountCodeSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  discountCodeSchema.nullish()
);

/**
 * How the order is to be paid for.
 *
 * Checked against `AVAILABLE_METHODS` rather than the full list of methods the
 * column can hold, so a method that exists in the vocabulary but is not yet
 * switched on — `card`, today — is refused here rather than written to an
 * order nobody will ever collect the money for. The drawer greys the same
 * option out from the same list, so the two agree by construction.
 *
 * Absent means cash on delivery. Not a guess: an older storefront build sends
 * no method at all, and cash on delivery is what the store did before the
 * field existed and what every order already on the books was.
 */
export const paymentMethodSchema = z
  .string()
  .trim()
  .toLowerCase()
  .default(DEFAULT_PAYMENT_METHOD)
  .refine(isAvailableMethod, {
    message: `We can only take ${AVAILABLE_METHODS.map(
      (method) => PAYMENT_COPY[method].label
    ).join(" or ")} right now`,
  });

export const checkoutPayloadSchema = z.object({
  items: z
    .array(cartItemSchema)
    .min(1, { message: "Your cart must contain at least one item to checkout" }),
  shippingAddress: shippingAddressSchema,
  discountCode: optionalDiscountCodeSchema,
  /* `.default()` only fires on `undefined`, and a client that has the field but
     left it unset sends `null` — so null is folded to undefined first and both
     spellings of "did not choose" land on cash on delivery. */
  paymentMethod: z.preprocess(
    (value) => (value === null ? undefined : value),
    paymentMethodSchema
  ),
});

/**
 * What /api/discount takes: a code, and the bag to judge it against.
 *
 * The lines rather than a subtotal, deliberately. A subtotal sent by the
 * browser is a number the browser chose, and quoting a discount against it
 * would mean quoting against a bag the shopper does not have. The route prices
 * the lines itself — see lib/api/cart.ts.
 */
export const discountPreviewSchema = z.object({
  code: discountCodeSchema,
  items: z.array(cartItemSchema).min(1, { message: "Your cart is empty" }),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CustomSizeInput = z.infer<typeof customSizeSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
export type CheckoutPayloadInput = z.infer<typeof checkoutPayloadSchema>;
export type DiscountPreviewInput = z.infer<typeof discountPreviewSchema>;
