import { describe, it, expect } from 'vitest';
import { getEnumOptions } from './getEnumOptions';

describe('getEnumOptions', () => {
  it('converts advert type enum values to label/value pairs', () => {
    const result = getEnumOptions(['pets.dogs.forSale', 'pets.dogs.studDog', 'pets.dogs.wanted', 'pets.dogs.rescueRehome']);
    expect(result).toEqual([
      { label: 'For Sale',      value: 'pets.dogs.forSale' },
      { label: 'Stud Dog',     value: 'pets.dogs.studDog' },
      { label: 'Wanted',       value: 'pets.dogs.wanted' },
      { label: 'Rescue Rehome', value: 'pets.dogs.rescueRehome' },
    ]);
  });

  it('converts breed enum values to label/value pairs', () => {
    const result = getEnumOptions([
      'pets.dogs.forSale.labradorRetriever',
      'pets.dogs.forSale.goldenRetriever',
      'pets.dogs.forSale.frenchBulldog',
    ]);
    expect(result).toEqual([
      { label: 'Labrador Retriever', value: 'pets.dogs.forSale.labradorRetriever' },
      { label: 'Golden Retriever',  value: 'pets.dogs.forSale.goldenRetriever' },
      { label: 'French Bulldog',    value: 'pets.dogs.forSale.frenchBulldog' },
    ]);
  });

  it('handles a single-segment value', () => {
    const result = getEnumOptions(['wanted']);
    expect(result).toEqual([{ label: 'Wanted', value: 'wanted' }]);
  });

  it('returns an empty array for empty input', () => {
    expect(getEnumOptions([])).toEqual([]);
  });
});
