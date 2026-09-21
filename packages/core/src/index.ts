/**
 * Logic that mobile will also need. Nothing in here may import React DOM,
 * Next.js, or any web-only API.
 *
 * This package is the reason the Android app costs roughly half of what the
 * web app cost instead of all of it. Everything above the render layer lives
 * here: the API client, query keys, the review session state machine, the
 * outbox, formatters. The React Query hooks are under `@recallify/core/react`
 * so that this entry point stays free of React.
 */
export * from './api/http';
export * from './api/client';
export * from './format';
export * from './keys';
export * from './outbox';
export * from './session';
