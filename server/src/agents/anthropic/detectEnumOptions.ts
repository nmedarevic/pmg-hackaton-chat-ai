import { getEnumOptions, type ChipOption } from './getEnumOptions';

// Breed fields are auto-detected from the image by the AI, so only show chips for fields
// the user genuinely needs to choose manually.
const FIELD_KEYWORDS: [fieldName: string, keywords: string[]][] = [
  ['advert_type', ['type of advert', 'advert type', 'what type', 'type would']],
];

export function detectEnumOptions(
  text: string,
  schema: Record<string, { enum?: string[]; [key: string]: unknown }>,
): ChipOption[] | null {
  const lower = text.toLowerCase();
  for (const [fieldName, keywords] of FIELD_KEYWORDS) {
    const fieldDef = schema[fieldName];
    if (!fieldDef?.enum) continue;
    if (keywords.some((k) => lower.includes(k))) {
      return getEnumOptions(fieldDef.enum);
    }
  }
  return null;
}
