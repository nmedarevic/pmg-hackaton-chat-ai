import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../graphqlClient', () => ({
  graphqlRequest: vi.fn(),
}));

import { graphqlRequest } from '../graphqlClient';
const mockGraphqlRequest = vi.mocked(graphqlRequest);

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  process.env.PMG_EMAIL_USER = 'user@test.com';
  process.env.PMG_PASSWORD_USER = 'userpass';
});

describe('loginWith', () => {
  it('returns the access token', async () => {
    mockGraphqlRequest.mockResolvedValueOnce({
      login: { accessToken: { token: 'user-token-xyz' } },
    });

    const { loginWith } = await import('./login');
    const token = await loginWith('PMG_EMAIL_USER', 'PMG_PASSWORD_USER');

    expect(token).toBe('user-token-xyz');
    expect(mockGraphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'Login',
        variables: { email: 'user@test.com', password: 'userpass' },
      }),
    );
  });

  it('throws when env vars are missing', async () => {
    delete process.env.PMG_EMAIL_USER;

    const { loginWith } = await import('./login');
    await expect(loginWith('PMG_EMAIL_USER', 'PMG_PASSWORD_USER')).rejects.toThrow(
      'PMG_EMAIL_USER and PMG_PASSWORD_USER must be set',
    );
  });
});
