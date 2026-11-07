/** Line icons (24×24, currentColor). Used instead of emoji everywhere in the UI. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 20, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  ...rest,
});

export const IconTransit = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="14" rx="3" />
    <path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4M9 7h6" />
    <circle cx="8.5" cy="14" r="0.6" fill="currentColor" />
    <circle cx="15.5" cy="14" r="0.6" fill="currentColor" />
  </svg>
);

export const IconCar = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 16V11l2-5h10l2 5v5" />
    <path d="M3 16h18v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2M7 16v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2M5 11h14" />
    <circle cx="8" cy="13.5" r="0.6" fill="currentColor" />
    <circle cx="16" cy="13.5" r="0.6" fill="currentColor" />
  </svg>
);

export const IconRideshare = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 18v-4l1.6-4h10.8l1.6 4v4" />
    <path d="M3 18h18v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5V18M6 18v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5V18M5 14h14" />
    <path d="M12 2.5a2.5 2.5 0 0 1 2.5 2.5c0 1.8-2.5 4-2.5 4S9.5 6.8 9.5 5A2.5 2.5 0 0 1 12 2.5Z" />
  </svg>
);

export const IconRoll = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="5" r="2" />
    <path d="M7 19h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" strokeDasharray="0.5 3.5" />
  </svg>
);

export const IconPin = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

export const IconCrosshair = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </svg>
);

export const IconSwap = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
  </svg>
);

export const IconAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2Z" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </svg>
);

export const IconWarning = (p: P) => (
  <svg {...base(p)}>
    <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17v.01" />
  </svg>
);

export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </svg>
);

export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconSliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const IconSpark = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
  </svg>
);
