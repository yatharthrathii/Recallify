/**
 * Reading other apps' exports into the one shape the API imports.
 *
 * Runs in the browser, where the file is: a deck export with years of history
 * can be tens of megabytes, most of it media that is not imported, and the
 * useful part, the cards and their review log, is small. Reading it on the
 * device means nothing large is uploaded and the preview is instant. The same
 * code runs in Node for the tests.
 *
 * The SQLite engine (sql.js) is passed in by the caller rather than imported
 * here, because where its WebAssembly comes from differs by host.
 */
export type * from './types';
/** The engine the caller must supply; re-exported so a host needs no types of its own. */
export type { SqlJsStatic } from 'sql.js';
export { parseApkg, ImportError, reviewIdFor } from './apkg';
export { parseCsv, parseRows, detectSeparator } from './csv';
export { chunkDeck, estimateCardBytes, type ImportChunk } from './chunk';
export { htmlToText, decodeEntities } from './text';
export { renderTemplate, renderCloze, type RenderContext, type Rendered } from './template';
export * from './limits';
