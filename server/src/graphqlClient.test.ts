import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeGraphQLResponse(data: unknown) {
  return { ok: true, json: async () => ({ data }) };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  process.env.PMG_SERVER_URL = 'https://pmg.example.com/graphql';
  process.env.LMS_PROXY_API_TOKEN = 'proxy-token';
});

describe('createListing', () => {
  it('returns id and slug', async () => {
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ createNewListing: { id: 'listing-123', slug: 'golden-retriever-pups' } }),
    );

    const { createListing } = await import('./graphqlClient');
    const result = await createListing('user-token', {} as any);

    expect(result).toEqual({ id: 'listing-123', slug: 'golden-retriever-pups' });
  });

  it('throws on GraphQL errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: 'Unauthorized' }] }),
    });

    const { createListing } = await import('./graphqlClient');
    await expect(createListing('bad-token', {} as any)).rejects.toThrow('GraphQL error');
  });
});

describe('payListingFee', () => {
  it('resolves when mutation succeeds', async () => {
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ submitPendingPaymentListing: true }),
    );

    const { payListingFee } = await import('./graphqlClient');
    await expect(payListingFee('admin-token', 'listing-123')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('publishListing', () => {
  it('resolves when mutation succeeds', async () => {
    mockFetch.mockResolvedValueOnce(
      makeGraphQLResponse({ publishListing: true }),
    );

    const { publishListing } = await import('./graphqlClient');
    await expect(publishListing('admin-token', 'listing-123')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
