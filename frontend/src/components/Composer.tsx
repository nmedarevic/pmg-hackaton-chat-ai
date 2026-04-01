import { AIMessageComposer } from "@stream-io/chat-react-ai";
import { useEffect, useRef, useState } from "react";
import {
	Channel,
	isImageFile,
	type LocalUploadAttachment,
	type UploadRequestFn,
} from "stream-chat";
import {
	useAttachmentsForPreview,
	useChannelActionContext,
	useChannelStateContext,
	useChatContext,
	useMessageComposer,
} from "stream-chat-react";
import { startAiAgent } from "../api";
import petSchema from "../../../schema/petSchema.json";

const isWatchedByAI = (channel: Channel) => {
	return Object.keys(channel.state.watchers).some((watcher) =>
		watcher.startsWith("ai-bot")
	);
};

type InputMode = "chat" | "audio";

export const Composer = () => {
	const { client } = useChatContext();
	const { updateMessage, sendMessage } = useChannelActionContext();
	const { channel } = useChannelStateContext();
	const composer = useMessageComposer();
	const { attachments } = useAttachmentsForPreview();

	// chat | audio toggle — shown after first image is uploaded
	const [inputMode, setInputMode] = useState<InputMode>("chat");
	const [showModeToggle, setShowModeToggle] = useState(false);
	const hasUploadedImage = useRef(false);

	// Watch for the first image attachment upload to reveal the toggle
	useEffect(() => {
		if (hasUploadedImage.current) return;
		const hasImage = attachments.some(
			(a) => a.localMetadata.file && isImageFile(a.localMetadata.file as File)
		);
		if (hasImage) {
			hasUploadedImage.current = true;
			setShowModeToggle(true);
		}
	}, [attachments]);

	// Also reveal toggle after AI sends its first breed analysis reply
	useEffect(() => {
		const listener = channel.on("message.new", (event) => {
			if (event.message?.ai_generated && !hasUploadedImage.current) {
				// First AI reply after image → show toggle
				setShowModeToggle(true);
			}
			if (event.type === "data_collection_complete") {
				console.log("Data collection complete:", event.collected_data);
			}
		});
		return () => listener.unsubscribe();
	}, [channel]);

	useEffect(() => {
		if (!composer) return;

		const upload: UploadRequestFn = (file) => {
			const f = isImageFile(file) ? client.uploadImage : client.uploadFile;
			return f.call(client, file as File);
		};

		const previousDefault = composer.attachmentManager.doDefaultUploadRequest;
		composer.attachmentManager.setCustomUploadFn(upload);
		return () => composer.attachmentManager.setCustomUploadFn(previousDefault);
	}, [client, composer]);

	return (
		<div className="tut__composer-container">
			{/* Chat / Audio mode toggle — appears after first image */}
			{showModeToggle && (
				<div
					style={{
						display: "flex",
						gap: "0.5rem",
						padding: "0.5rem 0.75rem",
						borderBottom: "1px solid #e5e7eb",
						background: "#f9fafb",
						alignItems: "center",
					}}
				>
					<span style={{ fontSize: "0.75rem", color: "#6b7280", marginRight: "0.25rem" }}>
						Continue via:
					</span>
					<button
						type="button"
						onClick={() => setInputMode("chat")}
						style={{
							padding: "0.25rem 0.75rem",
							borderRadius: "9999px",
							border: "1px solid",
							fontSize: "0.8rem",
							cursor: "pointer",
							fontWeight: inputMode === "chat" ? 600 : 400,
							background: inputMode === "chat" ? "#111827" : "#fff",
							color: inputMode === "chat" ? "#fff" : "#374151",
							borderColor: inputMode === "chat" ? "#111827" : "#d1d5db",
							transition: "all 0.15s",
						}}
					>
						💬 Chat
					</button>
					<button
						type="button"
						onClick={() => setInputMode("audio")}
						style={{
							padding: "0.25rem 0.75rem",
							borderRadius: "9999px",
							border: "1px solid",
							fontSize: "0.8rem",
							cursor: "pointer",
							fontWeight: inputMode === "audio" ? 600 : 400,
							background: inputMode === "audio" ? "#111827" : "#fff",
							color: inputMode === "audio" ? "#fff" : "#374151",
							borderColor: inputMode === "audio" ? "#111827" : "#d1d5db",
							transition: "all 0.15s",
						}}
					>
						🎤 Voice
					</button>
				</div>
			)}

			<AIMessageComposer
				onChange={(e) => {
					const input = e.currentTarget.elements.namedItem(
						"attachments"
					) as HTMLInputElement | null;

					const files = input?.files ?? null;

					if (files) {
						composer.attachmentManager.uploadFiles(files);
					}
				}}
				onSubmit={async (e) => {
					const event = e;
					event.preventDefault();

					const target = event.currentTarget;
					const formData = new FormData(target);
					const message = formData.get("message");
					composer.textComposer.setText(message as string);

					const composedData = await composer.compose();
					if (!composedData) return;

					target.reset();
					composer.clear();

					updateMessage(composedData?.localMessage);

					if (!channel.initialized) {
						await channel.watch();
					}

					const platform = "anthropic";
					const model = "claude-haiku-4-5";

					if (!isWatchedByAI(channel)) {
						await startAiAgent(channel, model, platform, petSchema);
					}

					await sendMessage(composedData);
				}}
			>
				<AIMessageComposer.AttachmentPreview>
					{attachments.map((attachment) => (
						<AIMessageComposer.AttachmentPreview.Item
							key={attachment.localMetadata.id}
							file={attachment.localMetadata.file as File}
							state={attachment.localMetadata.uploadState}
							imagePreviewSource={
								attachment.thumb_url ||
								(attachment.localMetadata.previewUri as string)
							}
							onDelete={() => {
								composer.attachmentManager.removeAttachments([
									attachment.localMetadata.id,
								]);
							}}
							onRetry={() => {
								composer.attachmentManager.uploadAttachment(
									attachment as LocalUploadAttachment
								);
							}}
						/>
					))}
				</AIMessageComposer.AttachmentPreview>

				{/* Show text input in chat mode, speech button prominently in audio mode */}
				{inputMode === "chat" ? (
					<AIMessageComposer.TextInput name="message" />
				) : (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "0.75rem",
							gap: "0.5rem",
							color: "#6b7280",
							fontSize: "0.85rem",
						}}
					>
						<AIMessageComposer.SpeechToTextButton />
						<span>Tap the mic and speak your answer</span>
					</div>
				)}

				<div
					style={{
						display: "flex",
						gap: "1rem",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<div style={{ display: "flex", gap: ".25rem", alignItems: "center" }}>
						<AIMessageComposer.FileInput name="attachments" />
						{/* Always show speech button in chat mode too, just less prominent */}
						{inputMode === "chat" && <AIMessageComposer.SpeechToTextButton />}
					</div>
					<AIMessageComposer.SubmitButton active={attachments.length > 0} />
				</div>
			</AIMessageComposer>
		</div>
	);
};
