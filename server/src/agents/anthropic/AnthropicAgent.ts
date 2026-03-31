import Anthropic from '@anthropic-ai/sdk';
import { AnthropicResponseHandler } from './AnthropicResponseHandler';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
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
    // Thread replies are NOT in channel.state.messages (Stream stores them separately),
    // so for thread replies we use historySlice as-is and just append the current message.
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
