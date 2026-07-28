import { useState } from 'react';
import markUrl from '../assets/cg-mark.png';
import wordmarkUrl from '../assets/cg-wordmark.png';

// Charcoal Group brand marks.
//
// The OFFICIAL artwork lives in `src/assets/` and is imported as a module so
// Vite bundles it through its asset pipeline. (NOTE: this project sets
// `publicDir: false` in vite.config.ts, so files under `public/` are NOT served
// — assets must be imported, not referenced by absolute URL.)
//   • src/assets/cg-mark.png      — the boxed "CG" monogram
//   • src/assets/cg-wordmark.png  — the full "Charcoal Group Restaurants" lockup
//
// To swap the artwork, replace those files (keep the names) — no code change.
// If an image fails to load, each component falls back to a monochrome SVG
// rendition so the UI never shows a broken image.
//
// The source artwork is black on transparent, so on dark surfaces (the
// Operational Center sidebar) we render it white via `invert` — a
// brightness(0) invert(1) filter. On light surfaces it shows as-is.

const MARK_SRC = markUrl;
const WORDMARK_SRC = wordmarkUrl;

const WHITE_FILTER = 'brightness(0) invert(1)';

interface LogoProps {
  className?: string;
  /** Render the (black) artwork as white — use on dark backgrounds. */
  invert?: boolean;
  title?: string;
}

// --- SVG fallbacks (used only if the official files aren't present) ---------

function MarkFallback({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} role="img" aria-label={title} fill="none">
      <title>{title}</title>
      <rect x="2.5" y="2.5" width="59" height="43" rx="3" stroke="currentColor" strokeWidth="3" />
      <rect x="7" y="7" width="50" height="34" rx="1.5" stroke="currentColor" strokeWidth="1.25" opacity="0.85" />
      <text x="32" y="34" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700" fontStyle="italic" fontSize="27" fill="currentColor" letterSpacing="-1">CG</text>
    </svg>
  );
}

function WordmarkFallback({ className, title }: { className?: string; title?: string }) {
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className ?? ''}`} aria-label={title} role="img">
      <span className="font-bold" style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: '0.12em', fontSize: '1.5em' }}>
        CHARCOAL&nbsp;GROUP
      </span>
      <span className="mt-1.5 font-medium opacity-80" style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: '0.45em', fontSize: '0.62em', paddingLeft: '0.45em' }}>
        RESTAURANTS
      </span>
    </span>
  );
}

// --- Public components ------------------------------------------------------

/** The boxed "CG" monogram — collapsed sidebar rail and small spots. */
export function LogoMark({ className = 'w-9 h-9', invert = false, title = 'Charcoal Group' }: LogoProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <MarkFallback className={className} title={title} />;
  return (
    <img
      src={MARK_SRC}
      alt={title}
      onError={() => setFailed(true)}
      className={`${className} object-contain`}
      style={invert ? { filter: WHITE_FILTER } : undefined}
    />
  );
}

/** Full horizontal wordmark lockup — login screen and generous-space contexts. */
export function LogoWordmark({ className = '', invert = false, title = 'Charcoal Group Restaurants' }: LogoProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <WordmarkFallback className={className} title={title} />;
  return (
    <img
      src={WORDMARK_SRC}
      alt={title}
      onError={() => setFailed(true)}
      className={`${className} object-contain`}
      style={invert ? { filter: WHITE_FILTER } : undefined}
    />
  );
}

/** Compact mark + name lockup for headers (mark beside the brand name). */
export function LogoLockup({ className = '', subtitle, invert = false }: { className?: string; subtitle?: string; invert?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark className="w-9 h-9 shrink-0" invert={invert} />
      <div className="min-w-0 leading-tight">
        <p className="font-bold" style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: '0.06em' }}>
          Charcoal Group
        </p>
        {subtitle && <p className="text-[11px] opacity-60 tracking-wide">{subtitle}</p>}
      </div>
    </div>
  );
}
