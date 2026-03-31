# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Stream Chat AI Integration** monorepo demonstrating how to build AI chat assistants with [Stream Chat](https://getstream.io/). It has a shared React frontend and three alternative backend approaches.

## Repository Structure

```
frontend/           # React + Vite + TypeScript UI (shared across all backends)
server/             # Direct Anthropic/OpenAI integration (manual agent implementation)
ai-sdk-sample/      # Vercel AI SDK via @stream-io/chat-ai-sdk (production-recommended)
z-langchain-sample/ # LangChain via @stream-io/chat-langchain-sdk
```

Each subdirectory is an independent Node.js project with its own `package.json`, `node_modules`, and `.env`.

## Commands

Each sub-project is run independently — `cd` into the relevant directory first.

### Frontend
```bash
cd frontend
npm install
npm run dev        # Start dev server (Vite)
npm run build      # TypeScript check + Vite build
npm run lint       # ESLint
```

### Server (direct Anthropic/OpenAI)
```bash
cd server
npm install
npm run start      # tsc + node dist/index.js
```

### AI SDK Sample (recommended backend)
```bash
cd ai-sdk-sample
npm install
npm run start      # node src/index.ts (Node 24 required)
```

### LangChain Sample
```bash
cd z-langchain-sample
npm install
npm run start      # tsc + node dist/index.js
```

## Environment Setup

Each backend needs a `.env` file (copy from `.env.example`):

```
STREAM_API_KEY=
STREAM_API_SECRET=
ANTHROPIC_API_KEY=      # for server/ or ai-sdk-sample with Anthropic
OPENAI_API_KEY=         # for server/ or ai-sdk-sample with OpenAI
```

Frontend `.env`:
```
VITE_STREAM_API_KEY=
VITE_STREAM_USER_TOKEN=
VITE_AI_ASSISTANT_URL=http://localhost:3000
```

## Architecture

### Data Flow
1. Frontend initializes a Stream Chat client and renders channels/messages
2. User clicks "Start AI Agent" → frontend POSTs to `/start-ai-agent` on the backend
3. Backend creates an AI bot user in Stream, joins the channel, and begins listening to `message.new` events
4. When a user sends a message, the bot calls the LLM and streams the response back via Stream Chat's `sendMessageChunks` / partial update API
5. Custom Stream events (`ai_indicator.update/clear/stop`) drive the `AIStateIndicator` UI component

### Backend Agent Pattern (`server/`)
- `agents/createAgent.ts` is a factory that returns platform-specific agents (`AnthropicAgent` or `OpenAIAgent`)
- Agents are stored in an in-memory `Map` keyed by channel ID with 8-hour inactivity cleanup
- Each agent implements `AIAgent` interface with `handleMessage` and `dispose` methods

### AI SDK Sample (`ai-sdk-sample/`)
- Uses `AgentManager` from `@stream-io/chat-ai-sdk` which wraps the Vercel AI SDK
- Supports Anthropic, OpenAI, Google Gemini, xAI via environment variable selection
- Optional Mem0 integration for persistent memory across sessions (set `MEM0_API_KEY`)
- Additional `/register-tools` endpoint for client-side tool registration

### Frontend Components (`frontend/src/`)
- `App.tsx`: Initializes Stream Chat client from JWT; extracts `userId` from token payload
- `ChatContent.tsx`: Main layout — channel list + message list + composer
- `Composer.tsx`: Message input + start/stop AI agent buttons
- `AIStateIndicator.tsx`: Shows "thinking" / "checking sources" states from `ai_indicator` events
- `api/index.ts`: `startAiAgent()` / `summarizeConversation()` — the only frontend→backend calls

### Key Stream Chat Concepts Used
- **Channel**: A conversation thread; the AI bot joins as a member
- **Message streaming**: Backend calls `channel.sendMessage()` then updates in chunks
- **Custom events**: `channel.sendEvent()` with type `ai_indicator.*` for UI state sync
- **Server client vs user client**: Backend uses API key+secret; frontend uses JWT token
