import React from "react";

type Surface = "plain" | "tint";

/**
 * The storefront's vertical rhythm lives here rather than being retyped on
 * every page, which is how `gap-x-4` and `gap-x-5` ended up side by side.
 *
 * Divider rule: adjacent sections alternate surface, and that change *is* the
 * divider — nothing here draws a hairline. Note the band uses `lilac`, not
 * `frost`: frost is #faf7fd, barely a step off white, so banding with it was
 * invisible and every section needed a border to compensate.
 */
interface SectionProps {
  surface?: Surface;
  /** Edge-to-edge content (full-bleed imagery): no container, no padding. */
  bleed?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

const SURFACE: Record<Surface, string> = {
  plain: "bg-white",
  tint: "bg-lilac",
};

export function Section({
  surface = "plain",
  bleed = false,
  id,
  className = "",
  children,
}: SectionProps) {
  if (bleed) {
    return (
      <section id={id} className={`relative ${SURFACE[surface]} ${className}`}>
        {children}
      </section>
    );
  }

  return (
    <section id={id} className={`${SURFACE[surface]} ${className}`}>
      <div className="mx-auto max-w-[1500px] px-6 py-16 sm:py-24 xl:px-10">{children}</div>
    </section>
  );
}

/** Standard gap between a SectionHeading and the content it introduces. */
export const HEADING_GAP = "mt-12";

/** Product and category grids share one gap so rows line up across sections. */
export const GRID_GAP = "gap-x-5 gap-y-12";
