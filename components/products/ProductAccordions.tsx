"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";

export interface AccordionPanel {
  title: string;
  body: React.ReactNode;
}

/** Detail / fabric-care / delivery accordions beneath the buy box. */
export function ProductAccordions({ panels }: { panels: AccordionPanel[] }) {
  const [open, setOpen] = useState<string | null>(panels[0]?.title ?? null);

  return (
    <div className="border-t border-line">
      {panels.map((panel) => {
        const expanded = open === panel.title;
        return (
          <div key={panel.title} className="border-b border-line">
            <button
              onClick={() => setOpen(expanded ? null : panel.title)}
              aria-expanded={expanded}
              className="eyebrow flex w-full cursor-pointer items-center justify-between py-5 text-ink"
            >
              {panel.title}
              {expanded ? (
                <Minus className="h-3.5 w-3.5 text-muted" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-muted" />
              )}
            </button>
            {expanded && (
              <div className="pb-6 text-[13px] leading-relaxed text-ink-soft">{panel.body}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
