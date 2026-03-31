import Anthropic from '@anthropic-ai/sdk';
import { AnthropicResponseHandler } from './AnthropicResponseHandler';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { Channel, Event, StreamChat } from 'stream-chat';
import type { AIAgent } from '../types';
import { buildMessageContent } from './buildMessageContent';
import { transformCollectedData } from '../../transformCollectedData';
import { loginAndCreateListing } from '../../graphqlClient';
import * as fs from 'fs';
import * as path from 'path';

const PET_SCHEMA: Record<string, unknown> = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../../schema/petSchema.json'), 'utf-8'),
);

const SYSTEM_PROMPT = `You are a pet listing assistant. Your job is to help the user create a complete pet advert.

## Step 1 — Image
If no image has been uploaded yet, ask the user to upload a photo of their pet. Do not proceed without one.

## Step 2 — Analyse the image
Once an image is provided, extract the following and pre-fill them without asking:
- **breed**: identify the breed and convert it to dot-notation camelCase prefixed with "pets.dogs.forSale.", e.g. "pets.dogs.forSale.labradorRetriever", "pets.dogs.forSale.frenchBulldog", "pets.dogs.forSale.goldenRetriever". Use your best judgement for the camelCase key.
- **advert_type**: default to "pets.dogs.forSale" unless context suggests otherwise.
- **title**: a short, catchy listing title.
- **description**: 2-3 sentence engaging listing description.

Present these to the user so they can confirm or correct them.

## Step 3 — Collect remaining fields
Ask the user (one or two at a time) for:
- **number_of_males** — how many male pups?
- **number_of_females** — how many female pups?
- **date_of_birth** — date of birth of the litter (ask in plain English, convert to YYYY-MM-DD internally)

## Step 4 — Submit
Once you have all fields confirmed, call submit_collected_data with the complete data.

### advert_type values (show the human label, submit the code):
- For Sale → pets.dogs.forSale
- Stud Dog → pets.dogs.studDog
- Wanted → pets.dogs.wanted
- Rescue / Rehome → pets.dogs.rescueRehome

Be conversational and friendly. If the user corrects a value, accept it.`;

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
      text: "Hello! 👋 I'm here to help you create a listing. To start, please upload a photo of your pet!",
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
- Ask for one field at a time in a natural, conversational way.
- If the user provides multiple fields at once, acknowledge all of them.
- If a value seems invalid for its expected type, politely ask for clarification.
- If the user wants to correct a previously given value, accept the correction.
- When you have collected ALL required fields, call the submit_collected_data tool with the complete data. Double check if some fields from the schema are missing.
- Do NOT call the tool until you have values for every field in the schema.
- The user can also upload images as attachments to their messages. If images are expected as part of the data collection, ask the user to upload them.
- When images are attached to a message, they will appear as attachments. Acknowledge that you received them.
- When analysing an image, populate the fields in the schema or ask which fields should be accepted.
- Be conversational and friendly, not robotic. Do not analyse the answers.`;
  }

  private buildTool(): Anthropic.Messages.Tool {
    const effectiveSchema = this.schema ?? PET_SCHEMA;
    const requiredFields = this.schema
      ? Object.keys(this.schema)
      : ['title', 'description', 'advert_type', 'breed', 'number_of_males', 'number_of_females', 'date_of_birth'];

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
    const historySize = this.schema ? 20 : 20;

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
      model: 'claude-sonnet-4-5',
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
          console.log('Data collection complete (raw):', JSON.stringify(input));

          const payload = transformCollectedData(input as any)
          if (this.lastImageUrl) {
            payload.images = [this.lastImageUrl];
          }

          console.log('Transformed listing payload:', JSON.stringify(payload));
          try {
            await this.channel.sendEvent({
              type: 'data_collection_complete',
              collected_data: payload,
            } as any);
          } catch (error) {
            console.error('Failed to send data_collection_complete event', error);
          }

          try {
            await loginAndCreateListing(payload);
          } catch (error) {
            console.error('Failed to create listing on remote server', error);
          }
        }
      },
    );
    void handler.run();
    this.handlers.push(handler);
  };
}
