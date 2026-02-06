const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 30;

export const normalizeTags = (input: string[]) => {
  const map = new Map<string, string>();

  for (const raw of input) {
    const cleaned = raw.trim();
    if (!cleaned) {
      continue;
    }

    const compact = cleaned.slice(0, MAX_TAG_LENGTH);
    const key = compact.toLowerCase();

    if (!map.has(key)) {
      map.set(key, compact);
    }

    if (map.size >= MAX_TAGS) {
      break;
    }
  }

  return Array.from(map.values());
};
