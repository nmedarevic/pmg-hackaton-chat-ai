# Pet Image Identification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pet image identification to the `server/` Anthropic agent — when a user uploads a photo the bot analyzes animal type, breed, count, color, and attributes; without a photo it persistently asks for one.

**Architecture:** Extract a pure `buildMessageContent` helper that maps Stream Chat message text + attachments to Anthropic vision content blocks; inject a system prompt and swap the model in `AnthropicAgent`; no frontend or other backend changes needed.

**Tech Stack:** TypeScript, `@anthropic-ai/sdk ^0.32`, `stream-chat`, `vitest` (new dev dep for tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server/src/agents/anthropic/buildMessageContent.ts` | Pure helper: text + Stream attachments → Anthropic content blocks |
| Create | `server/src/agents/anthropic/buildMessageContent.test.ts` | Unit tests for the helper |
| Modify | `server/src/agents/anthropic/AnthropicAgent.ts` | Add system prompt, swap model, use helper |
| Modify | `server/package.json` | Add vitest dev dep + test script |
| Create | `server/vitest.config.ts` | Vitest config (node environment) |

---

## Task 1: Set up Vitest

**Files:**
- Modify: `server/package.json`
- Create: `server/vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
cd server && npm install --save-dev vitest
```

Expected: vitest added to `devDependencies` in `package.json`.

- [ ] **Step 2: Create vitest config**

Create `server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Update test script in package.json**

In `server/package.json`, replace:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```
with:
```json
"test": "vitest run"
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
cd server && npm test
```

Expected output includes: `No test files found` or exits 0 with no failures.

- [ ] **Step 5: Commit**

```bash
cd server && git add package.json package-lock.json vitest.config.ts && git commit -m "chore: add vitest for server tests"
```

---

## Task 2: Create `buildMessageContent` helper (TDD)

**Files:**
- Create: `server/src/agents/anthropic/buildMessageContent.ts`
- Create: `server/src/agents/anthropic/buildMessageContent.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/agents/anthropic/buildMessageContent.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
cd server && npm test
```

Expected: 6 failures with `Cannot find module './buildMessageContent'`.

- [ ] **Step 3: Implement `buildMessageContent`**

Create `server/src/agents/anthropic/buildMessageContent.ts`:

```ts
import type { Attachment } from 'stream-chat';

type ImageBlock = {
  type: 'image';
  source: { type: 'url'; url: string };
};

type TextBlock = {
  type: 'text';
  text: string;
};

type ContentBlocks = Array<ImageBlock | TextBlock>;

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
    ...imageAttachments.map((a): ImageBlock => ({
      type: 'image',
      source: { type: 'url', url: a.image_url },
    })),
    { type: 'text', text },
  ];
}
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
cd server && npm test
```

Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
cd server && git add src/agents/anthropic/buildMessageContent.ts src/agents/anthropic/buildMessageContent.test.ts && git commit -m "feat: add buildMessageContent helper for Anthropic vision"
```

---

## Task 3: Update `AnthropicAgent` — system prompt, model, image handling

**Files:**
- Modify: `server/src/agents/anthropic/AnthropicAgent.ts`

- [ ] **Step 1: Replace the file contents**

Replace `server/src/agents/anthropic/AnthropicAgent.ts` with:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicResponseHandler } from './AnthropicResponseHandler';
import type { MessageParam } from '@anthropic-ai/sdk/src/resources/messages';
import type { Channel, Event, StreamChat } from 'stream-chat';
import type { AIAgent } from '../types';
import { buildMessageContent } from './buildMessageContent';

const SYSTEM_PROMPT = `You are a pet identification assistant for a pet listing service.

Your job:
- When the conversation starts, or when no image has been shared yet, ask the user to upload a photo of their pet. Be friendly but persistent — do not proceed without an image.
- Once an image is provided, analyze it and extract:
  - Animal type (dog, cat, horse, rabbit, etc.)
  - Breed (be specific; if uncertain, list the most likely breeds)
  - Number of animals in the image
  - Color(s) and coat/markings
  - Any other notable attributes (age estimate, size, distinguishing features)
- Format the results clearly so they can be used in a pet listing.
- After analysis, remain available for follow-up questions about the pet.
- If the user asks something unrelated to pets or the image, gently redirect them back to the pet listing task.`;

export class AnthropicAgent implements AIAgent {
  private anthropic?: Anthropic;
  private handlers: AnthropicResponseHandler[] = [];
  private lastInteractionTs = Date.now();

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel,
  ) {}

  dispose = async () => {
    this.chatClient.off('message.new', this.handleMessage);
    await this.chatClient.disconnectUser();

    this.handlers.forEach((handler) => handler.dispose());
    this.handlers = [];
  };

  getLastInteraction = (): number => this.lastInteractionTs;

  init = async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY as string | undefined;
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.anthropic = new Anthropic({ apiKey });

    this.chatClient.on('message.new', this.handleMessage);
  };

  private handleMessage = async (e: Event) => {
    if (!this.anthropic) {
      console.error('Anthropic SDK is not initialized');
      return;
    }

    if (!e.message || e.message.ai_generated) {
      console.log('Skip handling ai generated message');
      return;
    }

    const message = e.message.text;
    if (!message) return;

    this.lastInteractionTs = Date.now();

    const isThreadReply = e.message.parent_id !== undefined;

    // For non-thread messages, the current message is already the last entry
    // in channel.state.messages — exclude it so we can re-add it with vision content.
    const historySlice = this.channel.state.messages
      .slice(-5)
      .filter((msg) => msg.text && msg.text.trim() !== '');

    const historyBase = isThreadReply ? historySlice : historySlice.slice(0, -1);

    const messages: MessageParam[] = [
      ...historyBase.map((msg) => ({
        role: (msg.user?.id.startsWith('ai-bot') ? 'assistant' : 'user') as
          | 'user'
          | 'assistant',
        content: msg.text || '',
      })),
      {
        role: 'user',
        content: buildMessageContent(message, e.message.attachments),
      },
    ];

    const anthropicStream = await this.anthropic.messages.create({
      max_tokens: 1024,
      messages,
      model: 'claude-sonnet-4-5',
      system: SYSTEM_PROMPT,
      stream: true,
    });

    const { message: channelMessage } = await this.channel.sendMessage({
      text: '',
      ai_generated: true,
    });

    try {
      await this.channel.sendEvent({
        type: 'ai_indicator.update',
        ai_state: 'AI_STATE_THINKING',
        message_id: channelMessage.id,
      });
    } catch (error) {
      console.error('Failed to send ai indicator update', error);
    }

    await new Promise((resolve) => setTimeout(resolve, 750));

    const handler = new AnthropicResponseHandler(
      anthropicStream,
      this.chatClient,
      this.channel,
      channelMessage,
    );
    void handler.run();
    this.handlers.push(handler);
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to make sure nothing regressed**

```bash
cd server && npm test
```

Expected: `6 passed`.

- [ ] **Step 4: Commit**

```bash
cd server && git add src/agents/anthropic/AnthropicAgent.ts && git commit -m "feat: add pet image identification to Anthropic agent"
```

---

## Smoke Test (manual)

1. Start the server: `cd server && npm run start`
2. Open the frontend and start a new channel
3. Send a text message with no image → bot should respond asking for a photo
4. Send another text message → bot should keep asking
5. Upload a photo of an animal → bot should respond with type, breed, count, color, and other attributes
6. Ask a follow-up question about the pet → bot should answer in context
