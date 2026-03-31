import {
	Channel,
	MessageList,
	Window,
	MessageInput,
	useChatContext,
} from "stream-chat-react";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { AIStateIndicator } from "./AIStateIndicator";
import { useEffect } from "react";
import { nanoid } from "nanoid";
import { startAiAgent } from "../api";

export const ChatContent = () => {
	const { setActiveChannel, client, channel } = useChatContext();

	useEffect(() => {
		if (!channel) {
			setActiveChannel(
				client.channel("messaging", `ai-${nanoid()}`, {
					members: [client.userID as string],
					// @ts-expect-error fix - this is a hack that allows a custom upload function to run
					own_capabilities: ["upload-file"],
				})
			);
		}
	}, [channel]);

	useEffect(() => {
		if (!channel) return;
		const autoStart = async () => {
			if (!channel.initialized) {
				await channel.watch();
			}
			await startAiAgent(channel, "claude-sonnet-4-5", "anthropic");
		};
		autoStart().catch(console.error);
	}, [channel?.id]);

	return (
		<Channel initializeOnMount={false} Message={MessageBubble}>
			<Window>
				<MessageList />
				<AIStateIndicator />
				<MessageInput Input={Composer} />
			</Window>
		</Channel>
	);
};
