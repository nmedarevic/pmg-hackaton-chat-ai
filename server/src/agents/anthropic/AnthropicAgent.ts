import Anthropic from '@anthropic-ai/sdk';
import { AnthropicResponseHandler } from './AnthropicResponseHandler';
import type { MessageParam } from '@anthropic-ai/sdk/src/resources/messages';
import type { Channel, Event, StreamChat } from 'stream-chat';
import type { AIAgent } from '../types';

export class AnthropicAgent implements AIAgent {
  private anthropic?: Anthropic;
  private handlers: AnthropicResponseHandler[] = [];
  private lastInteractionTs = Date.now();

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel,
    private readonly schema?: Record<string, unknown>,
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

  private buildSystemPrompt(): string | undefined {
    if (!this.schema) return undefined;

    return `You are a friendly data collection assistant. Your job is to conversationally collect the following information from the user.

Schema of required fields:
${JSON.stringify(this.schema, null, 2)}

Rules:
- Greet the user briefly and start asking for the required information.
- Ask for one or two fields at a time in a natural, conversational way.
- If the user provides multiple fields at once, acknowledge all of them.
- If a value seems invalid for its expected type, politely ask for clarification.
- If the user wants to correct a previously given value, accept the correction.
- When you have collected ALL required fields, call the submit_collected_data tool with the complete data.
- Do NOT call the tool until you have values for every field in the schema.
- The user can also upload images as attachments to their messages. If images are expected as part of the data collection, ask the user to upload them.
- When images are attached to a message, they will appear as attachments. Acknowledge that you received them.
- Be conversational and friendly, not robotic.`;
  }

  private buildTool(): Anthropic.Messages.Tool | undefined {
    if (!this.schema) return undefined;

    return {
      name: 'submit_collected_data',
      description:
        'Submit the fully collected structured data when all required fields have been gathered from the user.',
      input_schema: {
        type: 'object' as const,
        properties: this.schema,
        required: Object.keys(this.schema),
      },
    };
  }

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

    const historySize = this.schema ? 20 : 5;
    const messages = this.channel.state.messages
      .slice(-historySize)
      .filter((msg) => msg.text && msg.text.trim() !== '')
      .map<MessageParam>((message) => ({
        role: message.user?.id.startsWith('ai-bot') ? 'assistant' : 'user',
        content: message.text || '',
      }));

    if (e.message.parent_id !== undefined) {
      messages.push({
        role: 'user',
        content: message,
      });
    }

    const systemPrompt = this.buildSystemPrompt();
    const tool = this.buildTool();

    const anthropicStream = await this.anthropic.messages.create({
      max_tokens: 1024,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages,
      model: 'claude-haiku-4-5',
      ...(tool ? { tools: [tool] } : {}),
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
      async (toolName, input) => {
        if (toolName === 'submit_collected_data') {
          console.log('Data collection complete:', JSON.stringify(input));
          try {
            await this.channel.sendEvent({
              type: 'data_collection.complete',
              collected_data: input,
            } as any);
          } catch (error) {
            console.error('Failed to send data_collection.complete event', error);
          }
        }
      },
    );
    void handler.run();
    this.handlers.push(handler);
  };
}
