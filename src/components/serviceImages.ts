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
  { keywords: ['kitchen'], src: require('../../assets/services/kitchen-cleaning.jpg') },
  { keywords: ['bathroom', 'washroom', 'toilet'], src: require('../../assets/services/bathroom-cleaning.jpg') },
  { keywords: ['sofa', 'couch', 'upholstery'], src: require('../../assets/services/sofa-cleaning.jpg') },
  { keywords: ['deep', 'full home', 'home clean'], src: require('../../assets/services/deep-cleaning.jpg') },
  { keywords: ['plumb', 'tap', 'pipe', 'leak'], src: require('../../assets/services/plumbing.jpg') },
];

const GENERIC: ImageSourcePropType = require('../../assets/services/service-generic.jpg');

/** Pick the bundled image best matching a service name (generic fallback). */
export function localServiceImage(name?: string): ImageSourcePropType {
  if (!name) return GENERIC;
  const n = name.toLowerCase();
  for (const entry of IMAGE_MAP) {
    if (entry.keywords.some((k) => n.includes(k))) return entry.src;
  }
  return GENERIC;
}
