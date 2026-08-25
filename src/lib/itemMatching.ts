// OC (Optimum Control) renumbers item-name suffixes when recipes roll over —
// in Aug 2026 "Bacon Sliced 22" became "Bacon Sliced 26", and every suffix
// (22/23/24/25) moved to 26 — which splits one item's history into two names
// anywhere we match or aggregate by exact name. Compare items on the name
// with any trailing standalone number removed; display whichever variant is
// most recent. Survives the next renumber (26 → 27) with no data rewrites.
export function itemMatchKey(name: string): string {
  return name.replace(/\s+\d{1,3}\s*$/, '').trim().toLowerCase();
}
