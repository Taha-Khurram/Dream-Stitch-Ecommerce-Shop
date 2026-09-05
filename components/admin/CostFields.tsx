"use client";

import React from "react";
import { Field } from "./ActionForm";
import { inputClass } from "./field-styles";
import { CURRENCY, formatPrice } from "@/lib/format";
import { marginPercent, unitProfit } from "@/lib/admin/cost";

/**
 * Price and cost, together, because neither means much without the other.
 *
 * The rest of the product form is uncontrolled — the browser holds the values
 * and the server action reads them out of `FormData`. These two are the
 * exception, and only because the line underneath them has to be able to say
 * what the pair *implies*: what one unit earns, and at what margin. Working
 * that out at the moment of typing is most of the point of asking for a cost
 * at all — somebody entering a price of 6,490 against a cost of 5,900 should
 * find that out here, not a quarter later on a dashboard.
 *
 * The field names are unchanged (`price`, `cost_price`), so `saveProduct` is
 * none the wiser about any of this. State is a string rather than a number
 * because a half-typed "64" and an empty box are different things, and
 * `Number("")` is 0 — which would report a product that costs nothing to make
 * rather than a question nobody has answered yet.
 */
export function CostFields({
  price,
  cost,
}: {
  price?: number | string | null;
  cost?: number | string | null;
}) {
  const [priceText, setPriceText] = React.useState(price == null ? "" : String(price));
  const [costText, setCostText] = React.useState(cost == null ? "" : String(cost));

  return (
    <>
      <Field label={`Price (${CURRENCY})`} name="price">
        <input
          id="price"
          name="price"
          required
          inputMode="decimal"
          value={priceText}
          onChange={(event) => setPriceText(event.target.value)}
          placeholder="6490"
          className={`${inputClass} tabular-nums`}
        />
      </Field>

      {/* The margin sits under the Field rather than inside it: `Field` clones
          a single child to wire up the label and the hint, and handing it two
          would quietly cost the input its `aria-describedby`. */}
      <div>
        <Field
          label={`Cost to make (${CURRENCY})`}
          name="cost_price"
          hint="Cloth, stitching, packaging — what one unit costs us. Never shown to customers."
        >
          <input
            id="cost_price"
            name="cost_price"
            inputMode="decimal"
            value={costText}
            onChange={(event) => setCostText(event.target.value)}
            placeholder="2100"
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <MarginLine price={priceText} cost={costText} />
      </div>
    </>
  );
}

/**
 * What the two numbers add up to, live.
 *
 * Silent until there is something to say — an empty cost box is answered by
 * the field's own hint, and flashing "-100% margin" at somebody three
 * keystrokes into a number helps nobody.
 *
 * A set that sells for less than it costs to make is called out in the warning
 * colour and then saved anyway. A loss-leader is a real decision, and a form
 * that refused it would be overruling the person running the shop.
 */
function MarginLine({ price, cost }: { price: string; cost: string }) {
  if (cost.trim() === "") return null;

  const sell = Number(price);
  const make = Number(cost);

  if (!Number.isFinite(sell) || !Number.isFinite(make) || make < 0 || sell <= 0) {
    return null;
  }

  const profit = unitProfit(sell, make);
  const margin = marginPercent(sell, make);

  return (
    <p
      role="status"
      className={`mt-1.5 text-xs tabular-nums ${profit < 0 ? "text-sale" : "text-muted"}`}
    >
      {profit < 0 ? (
        <>Sells {formatPrice(-profit)} below cost — every unit loses that much.</>
      ) : (
        <>
          <span className="font-medium text-ink">{formatPrice(profit)}</span> profit a
          unit{margin === null ? "" : ` · ${margin}% margin`}
        </>
      )}
    </p>
  );
}
