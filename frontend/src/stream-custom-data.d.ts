import { DefaultMessageData, type DefaultChannelData } from "stream-chat-react";

declare module "stream-chat" {
	interface CustomMessageData extends DefaultMessageData {
		ai_generated?: boolean;
	}
	interface CustomChannelData extends DefaultChannelData {
		summary?: string;
	}
	interface CustomEventData {
		collected_data?: Record<string, unknown>;
	}
	interface AnyEventObject extends CustomEventData {
		type: string;
	}
}
