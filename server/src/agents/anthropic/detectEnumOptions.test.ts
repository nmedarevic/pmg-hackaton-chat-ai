import { describe, it, expect } from 'vitest';
import { detectEnumOptions } from './detectEnumOptions';

const schema = {
  advert_type: { enum: ['pets.dogs.forSale', 'pets.dogs.studDog'] },
  breed: { enum: ['pets.dogs.forSale.labradorRetriever'] },
  mother_breed: { enum: ['pets.dogs.forSale.goldenRetriever'] },
  father_breed: { enum: ['pets.dogs.forSale.frenchBulldog'] },
  number_of_males: { type: 'number' },
};

describe('detectEnumOptions', () => {
  it('returns advert_type options when text mentions "type of advert"', () => {
    const result = detectEnumOptions('What type of advert would you like to create?', schema);
    expect(result).toEqual([
      { label: 'For Sale', value: 'pets.dogs.forSale' },
      { label: 'Stud Dog', value: 'pets.dogs.studDog' },
    ]);
  });

  it('returns breed options when text mentions "breed" without mother/father', () => {
    const result = detectEnumOptions("What is the breed of your pet?", schema);
    expect(result).toEqual([
      { label: 'Labrador Retriever', value: 'pets.dogs.forSale.labradorRetriever' },
    ]);
  });

  it('returns mother_breed options (not breed) when text mentions "mother"', () => {
    const result = detectEnumOptions("What is the mother's breed?", schema);
    expect(result).toEqual([
      { label: 'Golden Retriever', value: 'pets.dogs.forSale.goldenRetriever' },
    ]);
  });

  it('returns father_breed options (not breed) when text mentions "father"', () => {
    const result = detectEnumOptions("What is the father's breed?", schema);
    expect(result).toEqual([
      { label: 'French Bulldog', value: 'pets.dogs.forSale.frenchBulldog' },
    ]);
  });

  it('returns null when text does not match any enum field', () => {
    const result = detectEnumOptions('How many puppies are in the litter?', schema);
    expect(result).toBeNull();
  });

  it('returns null for a field that exists but has no enum', () => {
    const result = detectEnumOptions('How many males?', schema);
    expect(result).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = detectEnumOptions('WHAT TYPE OF ADVERT?', schema);
    expect(result).not.toBeNull();
  });
});
