import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import type { Attachment } from 'stream-chat';

type ContentBlocks = Array<ImageBlockParam | TextBlockParam>;

export function buildMessageContent(
  text: string,
  attachments: Attachment[] | undefined = [],
): string | ContentBlocks {
  const imageAttachments = (attachments ?? []).filter(
    (a): a is Attachment & { image_url: string } =>
      a.type === 'image' && typeof a.image_url === 'string' && a.image_url.length > 0,
  );

  if (imageAttachments.length === 0) {
    return text;
  }

  return [
    ...imageAttachments.map((a): ImageBlockParam => ({
      type: 'image',
      source: { type: 'url', url: a.image_url },
    })),
    { type: 'text', text },
  ];
}
