interface CollectedData {
  title: string;
  description: string;
  advert_type: string;
  breed: string;
  mother_breed: string;
  father_breed: string;
  number_of_males: number;
  number_of_females: number;
  date_of_birth: string;
  price: number;
  deposit_amount: number;
}

interface ListingAttribute {
  key: string;
  value: string;
}

export interface ListingPayload {
  category: string;
  title: string;
  description: string;
  price: { amount: number; currency: string };
  depositAmount: { amount: number; currency: string };
  requiredDeposit: number;
  hidePrice: boolean;
  preferredContact: string;
  location: Record<string, unknown>;
  attributes: ListingAttribute[];
  videos: string[];
  images: string[];
}

// Maps advert_type codes to listing type attribute values
const ADVERT_TYPE_TO_LISTING_TYPE: Record<string, string> = {
  'pets.dogs.forSale': 'pets.listingType.forSale',
  'pets.dogs.studDog': 'pets.listingType.studDog',
  'pets.dogs.wanted': 'pets.listingType.wanted',
  'pets.dogs.rescueRehome': 'pets.listingType.rescueRehome',
};

// Maps the forSale breed codes to the breed attribute codes
// e.g. "pets.dogs.forSale.labradorRetriever" → "pets.dogs.breed.labradorRetriever"
function toBreedAttributeValue(breedCode: string): string {
  const parts = breedCode.split('.');
  const breedName = parts[parts.length - 1];
  return `pets.dogs.breed.${breedName}`;
}

function padToLength(str: string, minLen: number, maxLen: number): string {
  let result = str.trim();
  if (result.length < minLen) {
    result = result.padEnd(minLen, '#');
  }
  if (result.length > maxLen) {
    result = result.slice(0, maxLen);
  }
  return result;
}

export function transformCollectedData(input: CollectedData): ListingPayload {
  const title = padToLength(input.title, 5, 50);
  const description = padToLength(input.description, 100, 200);
  const breedAttr = toBreedAttributeValue(input.breed);
  const motherBreedAttr = toBreedAttributeValue(input.mother_breed);
  const fatherBreedAttr = toBreedAttributeValue(input.father_breed);
  const dobTimestamp = new Date(input.date_of_birth).toISOString();

  const attributes: ListingAttribute[] = [
    { key: 'breed', value: breedAttr },
    { key: 'fatherBreed', value: fatherBreedAttr },
    { key: 'motherBreed', value: motherBreedAttr },
    { key: 'generation', value: 'f1' },
    { key: 'listingType', value: ADVERT_TYPE_TO_LISTING_TYPE[input.advert_type] || input.advert_type },
    { key: 'numberOfFemales', value: String(input.number_of_females) },
    { key: 'numberOfMales', value: String(input.number_of_males) },
    { key: 'dateOfBirth', value: dobTimestamp },
    { key: 'readyToLeave', value: '' },
    { key: 'viewedWith', value: 'true' },
    { key: 'microchipped', value: 'true' },
    { key: 'neutered', value: 'false' },
    { key: 'isBreeder', value: 'true' },
  ];

  return {
    category: 'pets.dogs',
    title,
    description,
    price: { amount: input.price, currency: 'GBP' },
    depositAmount: { amount: input.deposit_amount, currency: 'GBP' },
    requiredDeposit: input.deposit_amount,
    hidePrice: false,
    preferredContact: 'ChatOnly',
    location: {},
    attributes,
    videos: [],
    images: ['3794feb5-5fcf-4747-a8e3-fbd766520148'],
  };
}
