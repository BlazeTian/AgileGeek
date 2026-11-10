/**
 * VS Code's icon font, as the reference app uses it.
 *
 * The font is codicons (CC-BY-4.0, Microsoft): the same glyphs the
 * reference draws, at the same sizes, so the two windows look like the
 * same product rather than two takes on one.
 */
import type { CSSProperties } from 'react';

/** A glyph of the codicon font. */
export function Icon({
  codepoint,
  size = 15,
  className,
  style,
}: {
  codepoint: number;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`codicon ${className ?? ''}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        lineHeight: 1,
        ...style,
      }}
    >
      {String.fromCodePoint(codepoint)}
    </span>
  );
}

/** The glyphs this build uses, by the names VS Code gives them. */
export const Codicons = {
  add: 0xea60,
  folderOpened: 0xeaf7,
  search: 0xea6d,
  plug: 0xeb2d,
  note: 0xeb26,
  account: 0xeb99,
  settings: 0xeaf8,
  settingsGear: 0xeb51,
  archive: 0xea98,
  history: 0xea82,
  sparkle: 0xec10,
  robot: 0xec20,
  chevronDown: 0xeab4,
  chevronRight: 0xeab6,
  chevronUp: 0xeab7,
  close: 0xea76,
  shield: 0xeb53,
  lock: 0xea75,
  key: 0xeb11,
  zap: 0xea86,
  arrowUp: 0xeaa1,
  check: 0xeab2,
  loading: 0xeb19,
  folder: 0xea83,
  file: 0xea7b,
  beaker: 0xea79,
  history2: 0xeb78,
  organization: 0xea7e,
  chip: 0xec19,
  comment: 0xea6b,
  mention: 0xea6b,
} as const;
