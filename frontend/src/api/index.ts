import type { Channel } from "stream-chat";

const baseApiUrl = import.meta.env.VITE_AI_ASSISTANT_URL;

if (typeof baseApiUrl !== "string" || !baseApiUrl.length) {
	throw new Error("Missing VITE_AI_ASSISTANT_URL");
}

export interface UserLocation {
	latitude: number;
	longitude: number;
	accuracy?: number;
}

export const getUserLocation = (): Promise<UserLocation | null> => {
	if (!navigator.geolocation) return Promise.resolve(null);
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(pos) =>
				resolve({
					latitude: pos.coords.latitude,
					longitude: pos.coords.longitude,
					accuracy: pos.coords.accuracy,
				}),
			() => resolve(null),
			{ timeout: 5000 },
		);
	});
};

export const startAiAgent = async (
	channel: Channel,
	model: string,
	platform: "openai" | "anthropic" | "gemini" | "xai" | (string & {}) = "openai",
	schema?: Record<string, unknown>,
	userLocation?: UserLocation | null,
) =>
	fetch(`${baseApiUrl}/start-ai-agent`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			channel_id: channel.id,
			channel_type: channel.type,
			platform,
			model,
			schema,
			...(userLocation ? { user_location: userLocation } : {}),
		}),
	});

export const summarizeConversation = (text: string) =>
	fetch(`${baseApiUrl}/summarize`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text, platform: "anthropic", model: "claude-haiku-4-5" }),
	})
		.then((res) => res.json())
		.then((json) => json.summary as string);
