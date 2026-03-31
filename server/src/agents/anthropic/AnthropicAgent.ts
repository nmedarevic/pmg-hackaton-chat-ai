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
- Based on all observed details, compose a short catchy listing title and an engaging description (2-3 sentences).
- Present the analysis, title, and description to the user.
- After presenting your analysis, call the submit_collected_data tool with: type, breed, count, title, and description.
- After analysis, remain available for follow-up questions about the pet.
- If the user asks something unrelated to pets or the image, gently redirect them back to the pet listing task.`;

const PET_SCHEMA = {
  type: { type: 'string', description: 'Animal type (dog, cat, horse, rabbit, etc.)' },
  breed: { type: 'string', description: 'Specific breed or most likely breeds' },
  count: { type: 'number', description: 'Number of animals in the image' },
  title: { type: 'string', description: 'A short, catchy pet listing title' },
  description: { type: 'string', description: 'A suggested pet listing description based on all observed details' },
};

export class AnthropicAgent implements AIAgent {
  private anthropic?: Anthropic;
  private handlers: AnthropicResponseHandler[] = [];
  private lastInteractionTs = Date.now();
  private lastImageUrl: string | null = null;

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

    await this.channel.sendMessage({
      text: "Hello! 👋 I'm here to help to you create a listing. To start, please upload a photo of your pet!",
      ai_generated: true,
    });

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

  private buildTool(): Anthropic.Messages.Tool {
    const effectiveSchema = this.schema ?? PET_SCHEMA;
    const requiredFields = this.schema
      ? Object.keys(this.schema)
      : ['type', 'breed', 'count', 'title', 'description'];

    return {
      name: 'submit_collected_data',
      description:
        'Submit the fully collected structured data when all required fields have been gathered from the user.',
      input_schema: {
        type: 'object' as const,
        properties: effectiveSchema,
        required: requiredFields,
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

    const message = e.message.text ?? '';
    const hasImages = e.message.attachments?.some((a) => a.type === 'image' && a.image_url);
    if (!message && !hasImages) return;

    const imageUrl = e.message.attachments?.find(
      (a): a is typeof a & { image_url: string } => a.type === 'image' && typeof a.image_url === 'string',
    )?.image_url ?? null;
    if (imageUrl) this.lastImageUrl = imageUrl;

    this.lastInteractionTs = Date.now();

    const isThreadReply = e.message.parent_id !== undefined;
    const historySize = this.schema ? 20 : 5;

    // For non-thread messages, the current message is already the last entry
    // in channel.state.messages — exclude it so we can re-add it with vision content.
    // Thread replies are NOT in channel.state.messages (Stream stores them separately),
    // so for thread replies we use historySlice as-is and just append the current message.
    const historySlice = this.channel.state.messages
      .slice(-historySize)
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

    const systemPrompt = this.buildSystemPrompt();
    const tool = this.buildTool();

    const anthropicStream = await this.anthropic.messages.create({
      max_tokens: 1024,
      system: systemPrompt ?? SYSTEM_PROMPT,
      messages,
      model: this.schema ? 'claude-haiku-4-5' : 'claude-sonnet-4-5',
      tools: [tool],
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
          const collected_data = {
            ...input,
            image: this.lastImageUrl,
          };
          console.log('Data collection complete:', JSON.stringify(collected_data));
          try {
            await this.channel.sendEvent({
              type: 'data_collection_complete',
              collected_data,
            } as any);
          } catch (error) {
            console.error('Failed to send data_collection_complete event', error);
          }
        }
      },
    );
    void handler.run();
    this.handlers.push(handler);
  };
}
