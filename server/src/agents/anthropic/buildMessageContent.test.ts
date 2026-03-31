import { describe, it, expect } from 'vitest';
import { buildMessageContent } from './buildMessageContent';

describe('buildMessageContent', () => {
  it('returns plain string when no attachments', () => {
    const result = buildMessageContent('hello', []);
    expect(result).toBe('hello');
  });

  it('returns plain string when attachments are not images', () => {
    const result = buildMessageContent('see file', [
      { type: 'file', asset_url: 'https://example.com/doc.pdf' },
    ]);
    expect(result).toBe('see file');
  });

  it('returns vision content blocks when an image attachment is present', () => {
    const result = buildMessageContent('what breed is this?', [
      { type: 'image', image_url: 'https://cdn.stream-io.com/image.jpg' },
    ]);
    expect(result).toEqual([
      {
        type: 'image',
        source: { type: 'url', url: 'https://cdn.stream-io.com/image.jpg' },
      },
      { type: 'text', text: 'what breed is this?' },
    ]);
  });

  it('includes multiple image blocks when multiple image attachments are present', () => {
    const result = buildMessageContent('these two?', [
      { type: 'image', image_url: 'https://cdn.stream-io.com/img1.jpg' },
      { type: 'image', image_url: 'https://cdn.stream-io.com/img2.jpg' },
    ]);
    expect(result).toEqual([
      {
        type: 'image',
        source: { type: 'url', url: 'https://cdn.stream-io.com/img1.jpg' },
      },
      {
        type: 'image',
        source: { type: 'url', url: 'https://cdn.stream-io.com/img2.jpg' },
      },
      { type: 'text', text: 'these two?' },
    ]);
  });

  it('skips image attachments that have no image_url', () => {
    const result = buildMessageContent('hi', [
      { type: 'image' },
    ]);
    expect(result).toBe('hi');
  });

  it('returns plain string when attachments array is undefined', () => {
    const result = buildMessageContent('hi', undefined);
    expect(result).toBe('hi');
  });
});
