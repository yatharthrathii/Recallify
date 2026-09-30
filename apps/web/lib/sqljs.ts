import type { SqlJsStatic } from '@recallify/import';

type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

/** The UMD build sets a global; sql.js's own types declare it as always present, which it is not until the script has run. */
function installed(): InitSqlJs | undefined {
  return (globalThis as { initSqlJs?: InitSqlJs }).initSqlJs;
}

let loading: Promise<SqlJsStatic> | null = null;

/**
 * The SQLite engine, loaded only when the import page needs it.
 *
 * Fetched as two static files from public/vendor (see scripts/copy-sqljs.mjs)
 * rather than imported: the loader is written to run under Node, a worker and
 * a browser at once, and a bundler that tries to follow every branch of it
 * ends up shipping polyfills for the ones that do not apply. A script tag
 * costs nothing on any page but this one.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  loading ??= new Promise<SqlJsStatic>((resolve, reject) => {
    const init = () => {
      const initSqlJs = installed();
      if (!initSqlJs) {
        reject(new Error('The file reader did not load properly.'));
        return;
      }
      initSqlJs({ locateFile: (file) => `/vendor/sqljs/${file}` }).then(resolve, reject);
    };
    if (installed()) {
      init();
      return;
    }
    const script = document.createElement('script');
    script.src = '/vendor/sqljs/sql-wasm.js';
    script.async = true;
    script.onload = init;
    script.onerror = () => {
      loading = null;
      reject(new Error('The file reader could not be loaded. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
