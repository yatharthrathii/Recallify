export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'recallify-theme';

/**
 * Runs in <head> before the first paint, so a user who chose dark never sees a
 * flash of paper. Browser storage can throw (private windows, blocked site
 * data), and the page has to render either way, hence the try.
 *
 * With nothing stored the attribute is left off and the light theme applies.
 * A visitor whose system is dark still gets light here; following the system
 * is something they turn on in settings.
 *
 * The second half is about the landing page. Chrome restores a scroll offset
 * on reload even when the page was left at the top, and a long page reloaded
 * at the top would come back a couple of hundred pixels down, past the start
 * of the headline. Taking restoration over for that one route puts every
 * reload back where the page begins. Every other route keeps the browser's
 * behaviour, so going back to a deck still returns to the row you left.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t);if(location.pathname==='/')history.scrollRestoration='manual'}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'dark' || stored === 'system' ? stored : 'light';
  } catch {
    return 'light';
  }
}

let fadeTimer: ReturnType<typeof setTimeout> | undefined;

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  // 'system' is an attribute of its own rather than the absence of one: with
  // no attribute the light theme applies, which is the default for everybody.

  // Cross-fade the change. The class only lives as long as the fade does.
  root.classList.add('theme-fade');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), 480);
  if (choice === 'light') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'light') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // The choice still applies for this visit; it just will not be remembered.
  }
}
