import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeGraphQLResponse(data: unknown) {
  return {
    ok: true,
    json: async () => ({ data }),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  process.env.PMG_SERVER_URL = 'https://pmg.example.com/graphql';
  process.env.PMG_EMAIL_USER = 'user@test.com';
  process.env.PMG_PASSWORD_USER = 'userpass';
  process.env.PMG_ADMIN_EMAIL = 'admin@test.com';
  process.env.PMG_ADMIN_PASSWORD = 'adminpass';
  process.env.PMG_CLIENT_URL = 'https://app.pmg.com';
});

describe('loginAndCreateListing', () => {
  it('returns id and slug after creating and publishing', async () => {
    // Call 1: user login
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ login: { accessToken: { token: 'user-token' } } }),
    );
    // Call 2: createNewListing
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ createNewListing: { id: 'listing-123', slug: 'golden-retriever-pups' } }),
    );
    // Call 3: admin login
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ login: { accessToken: { token: 'admin-token' } } }),
    );
    // Call 4: pay listing fee
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ submitPendingPaymentListing: true }),
    );
    // Call 5: publishListing
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ publishListing: true }),
    );

    const { loginAndCreateListing } = await import('./graphqlClient');
    const result = await loginAndCreateListing({} as any);

    expect(result).toEqual({ id: 'listing-123', slug: 'golden-retriever-pups' });
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('still returns slug even when pay fee or publishListing throws', async () => {
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ login: { accessToken: { token: 'user-token' } } }),
    );
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ createNewListing: { id: 'listing-123', slug: 'golden-retriever-pups' } }),
    );
    // admin login succeeds
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ login: { accessToken: { token: 'admin-token' } } }),
    );
    // pay fee throws
    mockFetch.mockRejectedValueOnce(new Error('pay fee failed'));

    const { loginAndCreateListing } = await import('./graphqlClient');
    const result = await loginAndCreateListing({} as any);

    expect(result).toEqual({ id: 'listing-123', slug: 'golden-retriever-pups' });
  });
});
