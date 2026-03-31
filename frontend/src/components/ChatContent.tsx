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
