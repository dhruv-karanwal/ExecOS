// ExecOS · Shared · input helpers used by several topics
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 1-20

const MAX_ITEMS = 1000;
const MAX_TICKS = 100000;

export function parseIntegerList(value, label, { min = 0, maxItems = MAX_ITEMS } = {}) {
  const source = String(value).trim();
  const tokens = source.includes(",")
    ? source.split(",").flatMap((part) => {
      const entry = part.trim();
      if (!entry) throw new Error(`${label} contains an empty value.`);
      return entry.split(/\s+/);
    })
    : source.split(/\s+/).filter(Boolean);
  if (!tokens.length) throw new Error(`${label} cannot be empty.`);
  if (tokens.length > maxItems) throw new Error(`${label} cannot contain more than ${maxItems} values.`);
  const values = tokens.map((token) => Number(token));
  if (values.some((item) => !Number.isSafeInteger(item) || item < min)) {
    throw new Error(`${label} must contain whole numbers greater than or equal to ${min}.`);
  }
  return values;
}

export { MAX_ITEMS, MAX_TICKS };
