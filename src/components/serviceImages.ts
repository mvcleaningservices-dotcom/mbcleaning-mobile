import { ImageSourcePropType } from 'react-native';

/**
 * Bundled service imagery, matched to a service by keywords in its name.
 *
 * To update a picture: replace the corresponding PNG file in
 * `mobile/assets/services/` (keep the same filename). No code changes needed —
 * an admin-set `imageUrl` on the service still overrides these, and anything
 * unmatched falls back to `service-generic.png`.
 */
const IMAGE_MAP: { keywords: string[]; src: ImageSourcePropType }[] = [
  { keywords: ['kitchen'], src: require('../../assets/services/kitchen-cleaning.png') },
  { keywords: ['bathroom', 'washroom', 'toilet'], src: require('../../assets/services/bathroom-cleaning.png') },
  { keywords: ['sofa', 'couch', 'upholstery'], src: require('../../assets/services/sofa-cleaning.png') },
  { keywords: ['deep', 'full home', 'home clean'], src: require('../../assets/services/deep-cleaning.png') },
  { keywords: ['plumb', 'tap', 'pipe', 'leak'], src: require('../../assets/services/plumbing.png') },
];

const GENERIC: ImageSourcePropType = require('../../assets/services/service-generic.png');

/** Pick the bundled image best matching a service name (generic fallback). */
export function localServiceImage(name?: string): ImageSourcePropType {
  if (!name) return GENERIC;
  const n = name.toLowerCase();
  for (const entry of IMAGE_MAP) {
    if (entry.keywords.some((k) => n.includes(k))) return entry.src;
  }
  return GENERIC;
}
