// Test helper (visual-refinement round). The stylesheets moved ~22 literal font
// sizes, ~19 gaps, 10 radii and 7 tracking values onto scale tokens (--fs-*,
// --space-*, --radius-*, --track-*, --weight-*) defined once in app.css :root.
// Pins that used to parse a literal size now resolve the token to its COMPUTED
// value and assert THAT (Grok/owner: assert the computed rem, not the token
// name) — so the pin still fails if the real size drifts, and the loudness
// hierarchy stays test-enforced by value.

/** Expand scale-token `var(--fs-… / --space-… / --radius-… / --track-… /
 *  --weight-…)` references in `css` to their literal values, read from
 *  `appCss`'s :root block. Palette vars and `--gd-cardw` are intentionally left
 *  intact (card-metric assertions still see `var(--gd-cardw)`). Scale tokens are
 *  flat literals, so a single non-recursive pass suffices. */
export function resolveScale(css: string, appCss: string): string {
  const tok: Record<string, string> = {};
  for (const m of appCss.matchAll(/(--(?:fs|space|radius|track|weight)-[a-z0-9]+):\s*([^;]+);/g)) {
    tok[m[1]!] = m[2]!.trim();
  }
  return css.replace(
    /var\((--(?:fs|space|radius|track|weight)-[a-z0-9]+)(?:,[^)]*)?\)/g,
    (whole, name) => tok[name] ?? whole,
  );
}

/** The numeric rem value a selector's `font-size` computes to, or null if the
 *  selector/rule is absent. Resolves scale tokens first. */
export function fontSizeRemOf(css: string, appCss: string, selector: string): number | null {
  const esc = selector.replace(/[.\\-]/g, '\\$&');
  const m = resolveScale(css, appCss).match(new RegExp(`${esc}\\s*\\{[^}]*font-size:\\s*([\\d.]+)rem`));
  return m ? Number(m[1]) : null;
}
