/**
 * Whether a question is asking *where*, judged from the text alone.
 *
 * Needed because the knowledge service classifies intent and, when it is
 * unreachable, nothing does — which is exactly the case on a deployment, where
 * the service does not run. Keying the location branch on that service's
 * `intent` field alone made the feature work locally and silently do nothing
 * in production, which is the worst of both.
 *
 * Word boundaries matter here: without them "near" matches inside "nearly"
 * and a question about whether something is nearly full becomes a map lookup.
 */
const LOCATIONAL = /\b(nearest|closest|near|nearby|where|around here|next to)\b/i;

export function looksLocational(text: string): boolean {
  return LOCATIONAL.test(text);
}
