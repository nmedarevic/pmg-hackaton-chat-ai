interface CollectedData {
  title: string;
  description: string;
  advert_type: string;
  breed: string;
  number_of_males: number;
  number_of_females: number;
  date_of_birth: string;
}

interface ListingAttribute {
  key: string;
  value: string;
}

interface ListingPayload {
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

export function transformCollectedData(input: CollectedData): ListingPayload {
  const breedAttr = toBreedAttributeValue(input.breed);
  const dobTimestamp = new Date(input.date_of_birth).toISOString();

  const attributes: ListingAttribute[] = [
    { key: 'breed', value: breedAttr },
    { key: 'fatherBreed', value: breedAttr },
    { key: 'motherBreed', value: breedAttr },
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
    title: input.title,
    description: input.description,
    price: { amount: 0, currency: 'GBP' },
    depositAmount: { amount: 0, currency: 'GBP' },
    requiredDeposit: 0,
    hidePrice: false,
    preferredContact: 'ChatOnly',
    location: {},
    attributes,
    videos: [],
    images: [],
  };
}
