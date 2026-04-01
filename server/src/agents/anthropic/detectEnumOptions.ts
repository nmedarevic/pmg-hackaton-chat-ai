import { getEnumOptions, type ChipOption } from './getEnumOptions';

// Ordered: father/mother must come before breed to avoid substring false-match on "breed"
const FIELD_KEYWORDS: [fieldName: string, keywords: string[]][] = [
  ['father_breed', ['father']],
  ['mother_breed', ['mother']],
  ['breed',        ['breed']],
  ['advert_type',  ['type of advert', 'advert type', 'what type', 'type would']],
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
