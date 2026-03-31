# Pet Image Identification — Design Spec
_Date: 2026-03-31_

## Overview

Add pet image identification to the `server/` backend. When a user uploads a photo in the chat, the Anthropic agent analyzes it and extracts animal type, breed, count, color, and other attributes useful for a pet listing. The bot opens every conversation by asking for an image and keeps asking until one is provided.

## Scope

- **In scope**: `server/src/agents/anthropic/AnthropicAgent.ts` only
- **Out of scope**: frontend changes, `ai-sdk-sample/`, `z-langchain-sample/`, OpenAI agent

## Architecture & Data Flow

1. User sends a message (with or without image) via Stream Chat frontend
2. `AnthropicAgent.handleMessage` fires with `e.message`
3. Check `e.message.attachments` for entries where `type === 'image'`
4. Build Anthropic message content:
   - If images present: array of `image` content blocks (using Stream CDN URL via `source.type = 'url'`) + `text` block
   - If no images: plain string (existing behavior)
5. Inject system prompt on every `messages.create` call
6. History (last 5 messages) keeps existing plain-text format
7. Response streams back via existing `AnthropicResponseHandler`

## Model

Change from `claude-haiku-4-5` → `claude-sonnet-4-5` for reliable vision and breed accuracy.

## System Prompt

```
You are a pet identification assistant for a pet listing service.

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
- If the user asks something unrelated to pets or the image, gently redirect them back to the pet listing task.
```

## Image Content Block Structure

```ts
// For each image attachment:
{ type: 'image', source: { type: 'url', url: attachment.image_url } }
// Followed by the user's text:
{ type: 'text', text: message }
```

Anthropic's vision API accepts public URLs directly — no base64 conversion needed. Stream CDN URLs are publicly accessible.

## Changes Required

| File | Change |
|------|--------|
| `server/src/agents/anthropic/AnthropicAgent.ts` | Add system prompt, image attachment detection, vision content blocks, update model |

## What Does Not Change

- `AnthropicResponseHandler.ts` — streaming logic unchanged
- Frontend — image upload already works via `AIMessageComposer.FileInput`
- History message building — last 5 messages stay as plain text
- All other backend files
