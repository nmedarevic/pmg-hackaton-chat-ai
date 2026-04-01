import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../graphqlClient', () => ({
  graphqlRequest: vi.fn(),
}));

import { graphqlRequest } from '../graphqlClient';
const mockGraphqlRequest = vi.mocked(graphqlRequest);

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe('uploadImage', () => {
  it('returns mediaId after successful 3-step upload', async () => {
    // Step 1: fetch image from Stream CDN
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (_: string) => 'image/jpeg' },
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    // Step 2: createUploadForm
    mockGraphqlRequest.mockResolvedValueOnce({
      createUploadForm: {
        mediaId: 'media-abc-123',
        form: {
          url: 'https://s3.amazonaws.com/bucket',
          fields: { key: 'uploads/file.jpg', 'Content-Type': 'image/jpeg' },
        },
      },
    });

    // Step 3: S3 POST (204)
    mockFetch.mockResolvedValueOnce({ status: 204 });

    // Step 4: confirmFileUpload
    mockGraphqlRequest.mockResolvedValueOnce({
      confirmFileUpload: { fileId: 'file-xyz', filePreviewUrl: 'https://cdn.pmg.com/file.jpg' },
    });

    const { uploadImage } = await import('./imageUpload');
    const result = await uploadImage('user-token', 'https://stream.cdn/image.jpg');

    expect(result).toBe('media-abc-123');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockGraphqlRequest).toHaveBeenCalledTimes(2);
    // S3 POST must have no Authorization header
    const s3Call = mockFetch.mock.calls[1];
    expect(s3Call[1]?.headers).toBeUndefined();
  });

  it('uses image/jpeg as default content-type when header is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (_: string) => null },
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    mockGraphqlRequest.mockResolvedValueOnce({
      createUploadForm: {
        mediaId: 'media-abc-123',
        form: { url: 'https://s3.amazonaws.com/bucket', fields: {} },
      },
    });
    mockFetch.mockResolvedValueOnce({ status: 204 });
    mockGraphqlRequest.mockResolvedValueOnce({
      confirmFileUpload: { fileId: 'file-xyz', filePreviewUrl: '' },
    });

    const { uploadImage } = await import('./imageUpload');
    await uploadImage('user-token', 'https://stream.cdn/image.jpg');

    expect(mockGraphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { uploadType: 'ListingMedia', contentType: 'image/jpeg' } },
      }),
    );
  });

  it('throws when image fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const { uploadImage } = await import('./imageUpload');
    await expect(uploadImage('user-token', 'https://stream.cdn/image.jpg')).rejects.toThrow(
      'Failed to fetch image: 403',
    );
  });

  it('throws when S3 POST returns non-204', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (_: string) => 'image/jpeg' },
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    mockGraphqlRequest.mockResolvedValueOnce({
      createUploadForm: {
        mediaId: 'media-abc-123',
        form: { url: 'https://s3.amazonaws.com/bucket', fields: {} },
      },
    });
    mockFetch.mockResolvedValueOnce({ status: 403 });

    const { uploadImage } = await import('./imageUpload');
    await expect(uploadImage('user-token', 'https://stream.cdn/image.jpg')).rejects.toThrow(
      'S3 upload failed with status 403',
    );
  });

  it('appends form fields before file in FormData', async () => {
    const appendOrder: string[] = [];
    const originalAppend = FormData.prototype.append;
    FormData.prototype.append = function(this: FormData, name: string, value: string | Blob, filename?: string) {
      appendOrder.push(name);
      if (filename !== undefined) {
        return originalAppend.call(this, name, value as any, filename);
      } else {
        return originalAppend.call(this, name, value as any);
      }
    } as typeof FormData.prototype.append;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (_: string) => 'image/jpeg' },
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    mockGraphqlRequest.mockResolvedValueOnce({
      createUploadForm: {
        mediaId: 'media-abc-123',
        form: {
          url: 'https://s3.amazonaws.com/bucket',
          fields: { key: 'uploads/file.jpg', policy: 'abc123' },
        },
      },
    });
    mockFetch.mockResolvedValueOnce({ status: 204 });
    mockGraphqlRequest.mockResolvedValueOnce({
      confirmFileUpload: { fileId: 'file-xyz', filePreviewUrl: '' },
    });

    const { uploadImage } = await import('./imageUpload');
    await uploadImage('user-token', 'https://stream.cdn/image.jpg');

    FormData.prototype.append = originalAppend;

    expect(appendOrder.indexOf('key')).toBeLessThan(appendOrder.indexOf('file'));
    expect(appendOrder.indexOf('policy')).toBeLessThan(appendOrder.indexOf('file'));
  });
});
