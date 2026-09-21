export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'recallify-theme';

/**
 * Runs in <head> before the first paint, so a user who chose dark never sees a
 * flash of paper. Browser storage can throw (private windows, blocked site
 * data), and the page has to render either way, hence the try.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

let fadeTimer: ReturnType<typeof setTimeout> | undefined;

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  // Cross-fade the change. The class only lives as long as the fade does.
  root.classList.add('theme-fade');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), 480);
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // The choice still applies for this visit; it just will not be remembered.
  }
}
