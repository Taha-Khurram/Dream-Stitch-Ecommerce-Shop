-- =============================================================================
-- place_order() — the whole of an order, in one transaction.
--
-- WHY THIS EXISTS
--
-- /api/checkout writes an order the only way PostgREST allows: insert the
-- order, then insert the items, then read each product's stock and write back
-- `stock - ordered`. Three round trips, no lock held across them, and the last
-- one is a read-modify-write. Two shoppers reaching the last unit at the same
-- moment both read `stock = 1`, both write `0`, and both are sold it.
--
-- Reserving stock is not something a client can do correctly from outside the
-- database, so this function does it inside: the product rows are locked, the
-- stock is verified against the lock, and the order, its lines and the
-- decrement are one atomic unit. Either all of it happens or none of it does,
-- and nothing needs unwinding by hand afterwards.
--
-- SECURITY DEFINER, and it has to be: the function decrements `products.stock`,
-- and a shopper has no UPDATE policy on `products` (admin_schema.sql). The
-- authorisation it replaces is written out below — it acts only as the caller,
-- only on the caller's own order.
--
-- Idempotent. Safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.place_order(
    p_items                   JSONB,
    p_shipping_address        JSONB,
    p_payment_method          TEXT    DEFAULT 'cod',
    p_discount_code           TEXT    DEFAULT NULL,
    p_discount_amount         NUMERIC DEFAULT 0,
    p_shipping_fee            NUMERIC DEFAULT 250,
    p_free_shipping_threshold NUMERIC DEFAULT 5000
)
RETURNS TABLE (order_id UUID, subtotal NUMERIC, total_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
-- Pin the schema: a SECURITY DEFINER function that resolves names through the
-- caller's search_path is a privilege-escalation hole.
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user     UUID := auth.uid();
    v_subtotal NUMERIC(10, 2);
    v_discount NUMERIC(10, 2);
    v_payable  NUMERIC(10, 2);
    v_shipping NUMERIC(10, 2);
    v_total    NUMERIC(10, 2);
    v_order    UUID;
    v_short    RECORD;
BEGIN
    -- The caller's own order, never anybody else's. `auth.uid()` is the only
    -- source of the owner — accepting a user id as a parameter would let any
    -- signed-in caller place an order in someone else's name.
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'no items' USING ERRCODE = '22023';
    END IF;

    -- 1. The payload, flattened once. `quantity` is summed per product because
    --    stock is held per product: two lines of the same sheet in different
    --    sizes are two orderable things but one claim on inventory, and
    --    checking them separately is how 2 + 2 gets past a stock of 3.
    CREATE TEMP TABLE _lines ON COMMIT DROP AS
    SELECT
        (item ->> 'product_id')::UUID    AS product_id,
        (item ->> 'quantity')::INT       AS quantity,
        NULLIF(item ->> 'size', '')      AS size,
        (item ->> 'custom_width')::NUMERIC  AS custom_width,
        (item ->> 'custom_height')::NUMERIC AS custom_height,
        NULLIF(item ->> 'custom_unit', '')  AS custom_unit
    FROM jsonb_array_elements(p_items) AS item;

    IF EXISTS (SELECT 1 FROM _lines WHERE quantity IS NULL OR quantity <= 0) THEN
        RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
    END IF;

    -- 2. Lock every product this order touches, in a deterministic order.
    --
    --    ORDER BY id is what stops two concurrent orders over the same two
    --    products from each holding the lock the other needs. The lock is held
    --    until this function's transaction ends, so the stock read in step 3
    --    is still true when step 5 writes against it.
    CREATE TEMP TABLE _stock ON COMMIT DROP AS
    SELECT p.id, p.price, p.stock, p.name
    FROM public.products p
    WHERE p.id IN (SELECT DISTINCT product_id FROM _lines)
    ORDER BY p.id
    FOR UPDATE;

    IF (SELECT count(*) FROM _stock) <> (SELECT count(DISTINCT product_id) FROM _lines) THEN
        RAISE EXCEPTION 'one or more products no longer exist' USING ERRCODE = '23503';
    END IF;

    -- 3. Verify against the locked rows, naming the product that is short so
    --    the caller can say something useful rather than "try again".
    SELECT s.name, s.stock, SUM(l.quantity) AS ordered
    INTO v_short
    FROM _lines l
    JOIN _stock s ON s.id = l.product_id
    GROUP BY s.id, s.name, s.stock
    HAVING SUM(l.quantity) > s.stock
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'insufficient stock for "%": % requested, % available',
            v_short.name, v_short.ordered, v_short.stock
            USING ERRCODE = 'P0001';
    END IF;

    -- 4. Money, from the locked prices — never from the payload. Mirrors
    --    calcTotal() in lib/pricing.ts: discount first, then delivery measured
    --    against the discounted subtotal. Tax is absent because shelf prices
    --    are GST-inclusive (TAX_RATE = 0); add it here and there together.
    SELECT COALESCE(SUM(s.price * l.quantity), 0)
    INTO v_subtotal
    FROM _lines l
    JOIN _stock s ON s.id = l.product_id;

    v_discount := LEAST(GREATEST(COALESCE(p_discount_amount, 0), 0), v_subtotal);
    v_payable  := v_subtotal - v_discount;
    v_shipping := CASE WHEN v_payable >= p_free_shipping_threshold THEN 0 ELSE p_shipping_fee END;
    v_total    := v_payable + v_shipping;

    -- 5. Order, lines and decrement — all or nothing.
    INSERT INTO public.orders (
        user_id, status, total_amount, shipping_address,
        payment_method, discount_code, discount_amount
    )
    VALUES (
        v_user, 'new', v_total, p_shipping_address,
        p_payment_method, p_discount_code, v_discount
    )
    RETURNING id INTO v_order;

    INSERT INTO public.order_items (
        order_id, product_id, quantity, unit_price,
        size, custom_width, custom_height, custom_unit
    )
    SELECT
        v_order, l.product_id, l.quantity, s.price,
        l.size, l.custom_width, l.custom_height, l.custom_unit
    FROM _lines l
    JOIN _stock s ON s.id = l.product_id;

    UPDATE public.products p
    SET stock = p.stock - claim.ordered
    FROM (SELECT product_id, SUM(quantity) AS ordered FROM _lines GROUP BY product_id) AS claim
    WHERE p.id = claim.product_id;

    RETURN QUERY SELECT v_order, v_subtotal, v_total;
END;
$$;

-- Callable by a signed-in shopper only. `anon` is deliberately not granted:
-- the function requires auth.uid(), so an anonymous call could only ever raise.
REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

COMMENT ON FUNCTION public.place_order IS
    'Atomically reserves stock and writes an order with its line items. Prices and stock come from locked product rows, never from the payload.';
