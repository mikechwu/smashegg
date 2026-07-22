// React-side i18n companion: rich interpolation. i18n/index.ts is
// deliberately framework-free (its own header), so the one helper that
// returns JSX lives here. Needed since the suit round: translated lines can
// embed a rendered part (the desk status interpolates a combo label whose
// straight-flush run carries an inline SuitMark), which string t() cannot.

import { Fragment, type ReactNode } from 'react';
import { t, type TranslationKey } from '.';

/** Like t(), but params may be ReactNodes: splits the translated template
 *  on its {param} tokens and interleaves. Unknown tokens render literally
 *  (same behavior as t()'s string path). */
export function tNode(key: TranslationKey, params: Record<string, ReactNode>): ReactNode {
  // t() without params returns the raw template, placeholders intact.
  const segments = t(key).split(/\{(\w+)\}/g);
  return segments.map((segment, i) =>
    i % 2 === 1 ? (
      <Fragment key={i}>
        {Object.prototype.hasOwnProperty.call(params, segment) ? params[segment] : `{${segment}}`}
      </Fragment>
    ) : (
      segment
    ),
  );
}
