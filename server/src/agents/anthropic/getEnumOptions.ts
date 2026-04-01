export type ChipOption = { label: string; value: string };

function camelToTitle(camel: string): string {
  return camel
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function getEnumOptions(enumValues: string[]): ChipOption[] {
  return enumValues.map((value) => {
    const lastSegment = value.split('.').at(-1) ?? value;
    return { label: camelToTitle(lastSegment), value };
  });
}
