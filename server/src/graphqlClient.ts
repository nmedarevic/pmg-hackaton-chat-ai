import type { ListingPayload } from './transformCollectedData';

const CREATE_LISTING_MUTATION = `
  mutation CreateNewListing($input: CreateNewListingInput!) {
    createNewListing(input: $input) {
      id
      slug
    }
  }
`;

const PAY_LISTING_FEE_MUTATION = `
  mutation SubmitPendingPaymentListing($input: SubmitPendingPaymentListingInput!) {
    submitPendingPaymentListing(input: $input)
  }
`;

const PUBLISH_LISTING_MUTATION = `
  mutation publishListing($input: PublishListingInput!) {
    publishListing(input: $input)
  }
`;

export async function graphqlRequest({
  query,
  variables,
  token,
  operationName,
}: {
  query: string;
  variables: Record<string, unknown>;
  token?: string;
  operationName?: string;
}): Promise<Record<string, unknown>> {
  const serverUrl = process.env.PMG_SERVER_URL;
  if (!serverUrl) throw new Error('PMG_SERVER_URL is not set');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-lms-proxy-api-token': process.env.LMS_PROXY_API_TOKEN || '',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(serverUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables, operationName }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

export async function createListing(
  token: string,
  payload: ListingPayload,
): Promise<{ id: string; slug: string }> {
  const data = await graphqlRequest({
    query: CREATE_LISTING_MUTATION,
    variables: { input: payload },
    token,
    operationName: 'CreateNewListing',
  });
  return data.createNewListing as { id: string; slug: string };
}

export async function payListingFee(token: string, listingId: string): Promise<void> {
  await graphqlRequest({
    query: PAY_LISTING_FEE_MUTATION,
    variables: { input: { id: listingId } },
    token,
    operationName: 'SubmitPendingPaymentListing',
  });
}

export async function publishListing(token: string, listingId: string): Promise<void> {
  await graphqlRequest({
    query: PUBLISH_LISTING_MUTATION,
    variables: { input: { listingIds: listingId } },
    token,
    operationName: 'publishListing',
  });
}
