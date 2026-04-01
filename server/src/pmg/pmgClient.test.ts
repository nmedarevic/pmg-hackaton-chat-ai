import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./login', () => ({ loginWith: vi.fn() }));
vi.mock('./imageUpload', () => ({ uploadImage: vi.fn() }));
vi.mock('../graphqlClient', () => ({
  graphqlRequest: vi.fn(),
  createListing: vi.fn(),
  payListingFee: vi.fn(),
  publishListing: vi.fn(),
}));

import { loginWith } from './login';
import { uploadImage } from './imageUpload';
import { createListing, payListingFee, publishListing } from '../graphqlClient';

const mockLoginWith = vi.mocked(loginWith);
const mockUploadImage = vi.mocked(uploadImage);
const mockCreateListing = vi.mocked(createListing);
const mockPayListingFee = vi.mocked(payListingFee);
const mockPublishListing = vi.mocked(publishListing);

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe('createPmgListing', () => {
  it('uploads image and includes mediaId in listing payload', async () => {
    // 3 logins when imageUrl is provided: upload token, listing token, admin token
    mockLoginWith
      .mockResolvedValueOnce('upload-token')
      .mockResolvedValueOnce('listing-token')
      .mockResolvedValueOnce('admin-token');
    mockUploadImage.mockResolvedValueOnce('media-abc-123');
    mockCreateListing.mockResolvedValueOnce({ id: 'listing-123', slug: 'golden-pups' });
    mockPayListingFee.mockResolvedValueOnce(undefined);
    mockPublishListing.mockResolvedValueOnce(undefined);

    const { createPmgListing } = await import('./pmgClient');
    const result = await createPmgListing({ images: [], title: 'test' } as any, 'https://stream.cdn/image.jpg');

    expect(result).toEqual({ id: 'listing-123', slug: 'golden-pups' });
    expect(mockUploadImage).toHaveBeenCalledWith('upload-token', 'https://stream.cdn/image.jpg');
    expect(mockCreateListing).toHaveBeenCalledWith(
      'listing-token',
      expect.objectContaining({ images: ['media-abc-123'] }),
    );
  });

  it('skips image upload when imageUrl is null', async () => {
    mockLoginWith.mockResolvedValueOnce('user-token').mockResolvedValueOnce('admin-token');
    mockCreateListing.mockResolvedValueOnce({ id: 'listing-123', slug: 'golden-pups' });
    mockPayListingFee.mockResolvedValueOnce(undefined);
    mockPublishListing.mockResolvedValueOnce(undefined);

    const { createPmgListing } = await import('./pmgClient');
    const result = await createPmgListing({ images: [], title: 'test' } as any, null);

    expect(result).toEqual({ id: 'listing-123', slug: 'golden-pups' });
    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockCreateListing).toHaveBeenCalledWith('user-token', expect.objectContaining({ images: [] }));
  });

  it('still returns id and slug when pay/publish fails', async () => {
    mockLoginWith.mockResolvedValueOnce('user-token').mockResolvedValueOnce('admin-token');
    mockCreateListing.mockResolvedValueOnce({ id: 'listing-123', slug: 'golden-pups' });
    mockPayListingFee.mockRejectedValueOnce(new Error('pay failed'));

    const { createPmgListing } = await import('./pmgClient');
    const result = await createPmgListing({ images: [], title: 'test' } as any, null);

    expect(result).toEqual({ id: 'listing-123', slug: 'golden-pups' });
  });

  it('uses separate user and admin tokens', async () => {
    mockLoginWith.mockResolvedValueOnce('user-token').mockResolvedValueOnce('admin-token');
    mockCreateListing.mockResolvedValueOnce({ id: 'listing-123', slug: 'golden-pups' });
    mockPayListingFee.mockResolvedValueOnce(undefined);
    mockPublishListing.mockResolvedValueOnce(undefined);

    const { createPmgListing } = await import('./pmgClient');
    await createPmgListing({ images: [] } as any, null);

    expect(mockLoginWith).toHaveBeenNthCalledWith(1, 'PMG_EMAIL_USER', 'PMG_PASSWORD_USER');
    expect(mockLoginWith).toHaveBeenNthCalledWith(2, 'PMG_ADMIN_EMAIL', 'PMG_ADMIN_PASSWORD');
    expect(mockPayListingFee).toHaveBeenCalledWith('admin-token', 'listing-123');
    expect(mockPublishListing).toHaveBeenCalledWith('admin-token', 'listing-123');
  });
});
