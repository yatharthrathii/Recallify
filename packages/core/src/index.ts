/**
 * Logic that mobile will also need. Nothing in here may import React DOM,
 * Next.js, or any web-only API.
 *
 * This package is the reason the Android app costs ~50-60% of what the web app
 * cost instead of 100%. Everything above the render layer lives here: the
 * review session state machine, query keys, TanStack Query hooks, formatters.
 * If that discipline slips, mobile doubles in price -- see
 * docs/02-ARCHITECTURE.md.
 *
 * Phase 6 fills this in alongside the web UI.
 */
export const PACKAGE_NAME = '@recallify/core';
