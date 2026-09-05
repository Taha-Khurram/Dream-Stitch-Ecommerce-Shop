-- ============================================================================
-- order_payment_method.sql — record HOW an order is being paid for.
--
-- Why this file exists
-- --------------------
-- The store takes cash on delivery. It says so in the announcement bar and on
-- the footer badges, and it has always been true in practice — checkout writes
-- an order and no money moves until a courier hands over a parcel. What was
-- missing was anywhere to write it down.
--
-- The cost of that gap is not hypothetical either. A packing slip could not
-- tell the driver to collect on this parcel, and the customer receipt printed
-- "Total paid" under a figure the customer had not paid.
--
-- So the method travels with the order. The vocabulary is `PAYMENT_METHODS` in
-- lib/orders/payment.ts, and the CHECK below mirrors it — changing one means
-- changing the other.
--
-- Depends on: ecommerce_schema.sql (the table).
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1. The column -------------------------------------------------------------
--    NOT NULL with a default, which backfills every existing row to 'cod' as
--    it is added. That is a claim about history, and it is a safe one: no
--    payment method other than cash on delivery has ever been reachable in
--    this app, so every order already on the books was a COD order. Leaving
--    them null would mean every receipt ever reprinted refuses to say how it
--    was paid for, about orders we know the answer for.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod';

-- 2. Only the methods the app knows ------------------------------------------
--    'card' is accepted by the column before it is offered at checkout: the
--    constraint is the slow half to change, so it learns the word first and
--    `AVAILABLE_METHODS` in lib/orders/payment.ts decides when an order may
--    actually be placed with it. Dropped first so a re-run widens rather than
--    collides.
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_check CHECK (
        payment_method IN ('cod', 'card')
    );

-- 3. The admin order list filters and sorts on this --------------------------
--    Cheap, and the panel's reason for wanting it is the daily one: "which of
--    today's orders is the driver collecting on".
CREATE INDEX IF NOT EXISTS idx_orders_payment_method
    ON public.orders(payment_method);

-- 4. Comment, so the column explains itself in the table editor --------------
COMMENT ON COLUMN public.orders.payment_method IS
    'How the order is paid for: ''cod'' (cash collected by the courier) or '
    '''card'' (prepaid). Mirrors PAYMENT_METHODS in lib/orders/payment.ts.';

-- 5. Let PostgREST see the new column ----------------------------------------
--    Without this the API keeps serving its cached schema and every checkout
--    that sends a method fails with PGRST204 until the cache happens to turn
--    over. Same last step as the other migrations that add columns.
NOTIFY pgrst, 'reload schema';

-- 6. Confirm it took ---------------------------------------------------------
--        SELECT payment_method, count(*)
--          FROM public.orders
--         GROUP BY payment_method;
--    Every pre-existing order reads 'cod'.
