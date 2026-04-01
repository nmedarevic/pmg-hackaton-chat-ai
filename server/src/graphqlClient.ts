import type { ListingPayload } from './transformCollectedData';

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken {
        token
        __typename
      }
      refreshToken {
        token
        __typename
      }
      __typename
    }
  }
`;

const CREATE_LISTING_MUTATION = `
  mutation CreateNewListing($input: CreateNewListingInput!) {
    createNewListing(input: $input) {
      id
      slug
    }
  }
`;

const PUBLISH_LISTING_MUTATION = `
  mutation publishListing($input: PublishListingInput!) {
    publishListing(input: $input)
  }
`;

async function graphqlRequest({
  query,
  variables,
  token,
  operationName,
}: {
  query: string;
  variables: Record<string, unknown>;
  token?: string;
  operationName?: string;
}) {
  const serverUrl = process.env.PMG_SERVER_URL;
  if (!serverUrl) throw new Error('PMG_SERVER_URL is not set');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${serverUrl}`, {
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

async function login(): Promise<string> {
  const email = process.env.PMG_EMAIL;
  const password = process.env.PMG_PASSWORD;
  if (!email || !password) {
    throw new Error('PMG_EMAIL and PMG_PASSWORD must be set');
  }

  const data = await graphqlRequest({ query: LOGIN_MUTATION, variables: { email, password }, operationName: 'Login' });
  return data.login.accessToken.token;
}

async function loginAsAdmin(): Promise<string> {
  const email = process.env.PMG_ADMIN_EMAIL;
  const password = process.env.PMG_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('PMG_ADMIN_EMAIL and PMG_ADMIN_PASSWORD must be set');
  }

  const data = await graphqlRequest({ query: LOGIN_MUTATION, variables: { email, password }, operationName: 'Login' });
  return data.login.accessToken.token;
}

export async function loginAndCreateListing(
  listingPayload: ListingPayload,
): Promise<{ id: string; slug: string }> {
  const token = await login();
  console.log('Logged in to remote server successfully');

  const data = await graphqlRequest({
    query: CREATE_LISTING_MUTATION,
    variables: { input: listingPayload },
    token,
    operationName: 'CreateNewListing',
  });

  const { id, slug } = data.createNewListing as { id: string; slug: string };
  console.log('Listing created successfully:', id, 'slug:', slug);

  try {
    const adminToken = await loginAsAdmin();
    await graphqlRequest({
      query: PUBLISH_LISTING_MUTATION,
      variables: { input: { listingIds: id } },
      token: adminToken,
      operationName: 'publishListing',
    });
    console.log('Listing published successfully');
  } catch (error) {
    console.error('Failed to publish listing (listing still created):', error);
  }

  return { id, slug };
}
