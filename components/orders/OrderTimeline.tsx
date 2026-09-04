import React from "react";
import { Check, Loader2, PauseCircle, XCircle } from "lucide-react";
import type { TrackingJourney, TrackingStep } from "@/lib/orders/tracking";

/**
 * The four stages of an order, drawn as a rail with the current one marked.
 *
 * Vertical at every width on purpose. A horizontal tracker has to letterbox its
 * copy into a column a quarter of the screen wide, and the note under each
 * stage — "Your set is being cut and made up" — is the half of this that
 * answers the question somebody came to ask. Down the page, each stage gets a
 * full line for it.
 *
 * The three states are separated by fill weight rather than by hue, matching
 * `StatusPill` next door: a solid mark is done, a ringed one is where the order
 * is now, a hairline one has not happened yet.
 */
export function OrderTimeline({ journey }: { journey: TrackingJourney }) {
  const { steps, cancelled, paused } = journey;

  return (
    <div>
      {cancelled && (
        <Notice
          tone="sale"
          icon={<XCircle className="h-4 w-4 shrink-0" strokeWidth={1.6} />}
          title="This order was cancelled"
          copy="Nothing further will be sent. If that is a surprise, get in touch and we will look into it."
        />
      )}

      {paused && (
        <Notice
          tone="muted"
          icon={<PauseCircle className="h-4 w-4 shrink-0" strokeWidth={1.6} />}
          title="This order is on hold"
          copy="It has paused where it is and somebody from the studio will be in touch about it."
        />
      )}

      <ol className={cancelled ? "mt-6 opacity-45" : "mt-6"}>
        {steps.map((step, index) => {
          const last = index === steps.length - 1;

          return (
            <li key={step.stage} className="relative flex gap-4 pb-7 last:pb-0">
              {/* The rail itself, drawn between this mark and the next. It is
                  purple only as far as the order has actually travelled. */}
              {!last && (
                <span
                  aria-hidden
                  className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px ${
                    step.state === "done" ? "bg-purple/45" : "bg-line"
                  }`}
                />
              )}

              <StepMark state={step.state} paused={paused} />

              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-[13px] font-medium leading-none ${
                    step.state === "upcoming" ? "text-faint" : "text-ink"
                  }`}
                >
                  {step.label}
                </p>
                <p
                  className={`mt-1.5 text-[12px] leading-relaxed ${
                    step.state === "upcoming" ? "text-faint" : "text-ink-soft"
                  }`}
                >
                  {step.note}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The dot beside a stage: solid behind, ringed at, hairline ahead. */
function StepMark({ state, paused }: { state: TrackingStep["state"]; paused: boolean }) {
  if (state === "done") {
    return (
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
    );
  }

  if (state === "current") {
    return (
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-purple bg-lilac text-purple">
        {/* A paused order is not working, so it does not spin. */}
        {paused ? (
          <span aria-hidden className="h-2 w-2 rounded-full bg-purple" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
        )}
      </span>
    );
  }

  return (
    <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-white">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-line" />
    </span>
  );
}

function Notice({
  tone,
  icon,
  title,
  copy,
}: {
  tone: "sale" | "muted";
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  const skin =
    tone === "sale"
      ? "border-sale/30 bg-sale/5 text-sale"
      : "border-line bg-frost text-ink-soft";

  return (
    <div className={`flex items-start gap-2.5 border p-3.5 ${skin}`}>
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-none">{title}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed opacity-80">{copy}</p>
      </div>
    </div>
  );
}
