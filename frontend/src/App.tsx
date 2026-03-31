import { Chat, useCreateChatClient } from "stream-chat-react";

import { ChatContent } from "./components/ChatContent";

const userToken = import.meta.env.VITE_STREAM_USER_TOKEN;
const apiKey = import.meta.env.VITE_STREAM_API_KEY;

if (typeof apiKey !== "string" || !apiKey.length) {
	throw new Error("Missing VITE_STREAM_API_KEY");
}

if (typeof userToken !== "string" || !userToken.length) {
	throw new Error("Missing VITE_STREAM_USER_TOKEN");
}

const userIdFromToken = (token: string) => {
	const [, payload] = token.split(".");
	const parsedPayload = JSON.parse(atob(payload));
	return parsedPayload.user_id as string;
};

const userId = userIdFromToken(userToken!);

function App() {
	const chatClient = useCreateChatClient({
		apiKey: apiKey!,
		tokenOrProvider: userToken!,
		userData: {
			id: userId,
		},
	});

	if (!chatClient) {
		return <div>Loading chat...</div>;
	}

	return (
		<Chat client={chatClient}>
			<ChatContent />
		</Chat>
	);
}

export default App;
