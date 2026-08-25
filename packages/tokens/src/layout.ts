/**
 * Space, shape and elevation. Deliberately tiny sets: consistency comes from
 * having few choices, not from remembering to be consistent.
 */

/** 4px base. Index into this, never write an arbitrary number. */
export const space = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

export const radius = { sm: 4, md: 8, lg: 12, full: 9999 } as const;

export const border = { hair: 1, strong: 2 } as const;

/**
 * Default to borders for separation. Shadow is reserved for things that
 * genuinely float above the page: dialogs, popovers, the command palette.
 */
export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgb(0 0 0 / 0.04)',
  md: '0 4px 12px rgb(0 0 0 / 0.06)',
} as const;

/** Three surface levels only. A fourth means the layout is wrong. */
export const elevation = ['bg', 'surface', 'surfaceAlt'] as const;

export const layoutWidth = {
  prose: 680,
  app: 1120,
  wide: 1360,
} as const;

export const breakpoint = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
