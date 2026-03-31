import { AIMessageComposer } from "@stream-io/chat-react-ai";
import { useEffect } from "react";
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
import { startAiAgent, summarizeConversation } from "../api";

const isWatchedByAI = (channel: Channel) => {
	return Object.keys(channel.state.watchers).some((watcher) =>
		watcher.startsWith("ai-bot")
	);
};
// import { summarizeConversation } from "../api";

export const Composer = () => {
	const { client } = useChatContext();
	const { updateMessage, sendMessage } = useChannelActionContext();
	const { channel } = useChannelStateContext();
	const composer = useMessageComposer();

	const { attachments } = useAttachmentsForPreview();

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

	useEffect(() => {
		const listener = channel.on((event) => {
			if (event.type === 'data_collection_complete') {
				console.log('Data collection complete:', event.collected_data);
			}
		});
		return () => listener.unsubscribe();
	}, [channel]);

	return (
		<div className="tut__composer-container">
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

				const schema = {
					title: { type: "string", description: "A title of the litter's advert" },
					description: { type: "string", description: "A brief description about the advert, the pets and the mother" },
				advert_type: {
					type: "string",
					description: [
						"The type of advert. Present the human-readable label to the user during conversation,",
						"but always submit the corresponding dot-notation code value listed below.",
						"Mapping (display name → code):",
						"  For Sale         → pets.dogs.forSale",
						"  Stud Dog         → pets.dogs.studDog",
						"  Wanted           → pets.dogs.wanted",
						"  Rescue / Rehome  → pets.dogs.rescueRehome",
					].join(" "),
					enum: [
						"pets.dogs.forSale",
						"pets.dogs.studDog",
						"pets.dogs.wanted",
						"pets.dogs.rescueRehome",
					],
				},
					breed: {
						type: "string",
						description: [
							"The breed of the pet. Present the human-readable breed name to the user during conversation,",
							"but always submit the corresponding dot-notation code value listed below.",
							"Mapping (display name → code):",
							"  Labrador Retriever         → pets.dogs.forSale.labradorRetriever",
							"  Golden Retriever           → pets.dogs.forSale.goldenRetriever",
							"  French Bulldog             → pets.dogs.forSale.frenchBulldog",
							"  German Shepherd            → pets.dogs.forSale.germanShepherd",
							"  Bulldog                    → pets.dogs.forSale.bulldog",
							"  Poodle                     → pets.dogs.forSale.poodle",
							"  Beagle                     → pets.dogs.forSale.beagle",
							"  Rottweiler                 → pets.dogs.forSale.rottweiler",
							"  Yorkshire Terrier          → pets.dogs.forSale.yorkshireTerrier",
							"  Dachshund                  → pets.dogs.forSale.dachshund",
							"  Boxer                      → pets.dogs.forSale.boxer",
							"  Siberian Husky             → pets.dogs.forSale.siberianHusky",
							"  Shih Tzu                   → pets.dogs.forSale.shihTzu",
							"  Border Collie              → pets.dogs.forSale.borderCollie",
							"  Cavalier King Charles Spaniel → pets.dogs.forSale.cavalierKingCharlesSpaniel",
						].join(" "),
						enum: [
							"pets.dogs.forSale.labradorRetriever",
							"pets.dogs.forSale.goldenRetriever",
							"pets.dogs.forSale.frenchBulldog",
							"pets.dogs.forSale.germanShepherd",
							"pets.dogs.forSale.bulldog",
							"pets.dogs.forSale.poodle",
							"pets.dogs.forSale.beagle",
							"pets.dogs.forSale.rottweiler",
							"pets.dogs.forSale.yorkshireTerrier",
							"pets.dogs.forSale.dachshund",
							"pets.dogs.forSale.boxer",
							"pets.dogs.forSale.siberianHusky",
							"pets.dogs.forSale.shihTzu",
							"pets.dogs.forSale.borderCollie",
							"pets.dogs.forSale.cavalierKingCharlesSpaniel",
						],
					},
				mother_breed: {
					type: "string",
					description: [
						"The breed of the mother. Present the human-readable breed name to the user during conversation,",
						"but always submit the corresponding dot-notation code value listed below.",
						"Mapping (display name → code):",
						"  Labrador Retriever         → pets.dogs.forSale.labradorRetriever",
						"  Golden Retriever           → pets.dogs.forSale.goldenRetriever",
						"  French Bulldog             → pets.dogs.forSale.frenchBulldog",
						"  German Shepherd            → pets.dogs.forSale.germanShepherd",
						"  Bulldog                    → pets.dogs.forSale.bulldog",
						"  Poodle                     → pets.dogs.forSale.poodle",
						"  Beagle                     → pets.dogs.forSale.beagle",
						"  Rottweiler                 → pets.dogs.forSale.rottweiler",
						"  Yorkshire Terrier          → pets.dogs.forSale.yorkshireTerrier",
						"  Dachshund                  → pets.dogs.forSale.dachshund",
						"  Boxer                      → pets.dogs.forSale.boxer",
						"  Siberian Husky             → pets.dogs.forSale.siberianHusky",
						"  Shih Tzu                   → pets.dogs.forSale.shihTzu",
						"  Border Collie              → pets.dogs.forSale.borderCollie",
						"  Cavalier King Charles Spaniel → pets.dogs.forSale.cavalierKingCharlesSpaniel",
					].join(" "),
					enum: [
						"pets.dogs.forSale.labradorRetriever",
						"pets.dogs.forSale.goldenRetriever",
						"pets.dogs.forSale.frenchBulldog",
						"pets.dogs.forSale.germanShepherd",
						"pets.dogs.forSale.bulldog",
						"pets.dogs.forSale.poodle",
						"pets.dogs.forSale.beagle",
						"pets.dogs.forSale.rottweiler",
						"pets.dogs.forSale.yorkshireTerrier",
						"pets.dogs.forSale.dachshund",
						"pets.dogs.forSale.boxer",
						"pets.dogs.forSale.siberianHusky",
						"pets.dogs.forSale.shihTzu",
						"pets.dogs.forSale.borderCollie",
						"pets.dogs.forSale.cavalierKingCharlesSpaniel",
					],
				},
				father_breed: {
					type: "string",
					description: [
						"The breed of the father. Present the human-readable breed name to the user during conversation,",
						"but always submit the corresponding dot-notation code value listed below.",
						"Mapping (display name → code):",
						"  Labrador Retriever         → pets.dogs.forSale.labradorRetriever",
						"  Golden Retriever           → pets.dogs.forSale.goldenRetriever",
						"  French Bulldog             → pets.dogs.forSale.frenchBulldog",
						"  German Shepherd            → pets.dogs.forSale.germanShepherd",
						"  Bulldog                    → pets.dogs.forSale.bulldog",
						"  Poodle                     → pets.dogs.forSale.poodle",
						"  Beagle                     → pets.dogs.forSale.beagle",
						"  Rottweiler                 → pets.dogs.forSale.rottweiler",
						"  Yorkshire Terrier          → pets.dogs.forSale.yorkshireTerrier",
						"  Dachshund                  → pets.dogs.forSale.dachshund",
						"  Boxer                      → pets.dogs.forSale.boxer",
						"  Siberian Husky             → pets.dogs.forSale.siberianHusky",
						"  Shih Tzu                   → pets.dogs.forSale.shihTzu",
						"  Border Collie              → pets.dogs.forSale.borderCollie",
						"  Cavalier King Charles Spaniel → pets.dogs.forSale.cavalierKingCharlesSpaniel",
					].join(" "),
					enum: [
						"pets.dogs.forSale.labradorRetriever",
						"pets.dogs.forSale.goldenRetriever",
						"pets.dogs.forSale.frenchBulldog",
						"pets.dogs.forSale.germanShepherd",
						"pets.dogs.forSale.bulldog",
						"pets.dogs.forSale.poodle",
						"pets.dogs.forSale.beagle",
						"pets.dogs.forSale.rottweiler",
						"pets.dogs.forSale.yorkshireTerrier",
						"pets.dogs.forSale.dachshund",
						"pets.dogs.forSale.boxer",
						"pets.dogs.forSale.siberianHusky",
						"pets.dogs.forSale.shihTzu",
						"pets.dogs.forSale.borderCollie",
						"pets.dogs.forSale.cavalierKingCharlesSpaniel",
					],
				},
				number_of_males: { type: "number", description: "Number of male pets in the litter" },
				number_of_females: { type: "number", description: "Number of female pets in the litter" },
				date_of_birth: { type: "string", description: "When were all pets born? User can add a date in any format, but the output should be always in ISO8601 date with UTC timezone" },
				price: { type: "number", description: "The asking price for each pet in GBP (pounds sterling). Ask the user for the price per puppy." },
				deposit_amount: { type: "number", description: "The deposit amount required to reserve a pet in GBP (pounds sterling). Ask the user for the deposit amount." },
			};

					if (!isWatchedByAI(channel)) {
						await startAiAgent(channel, model, platform, schema);
					}

					await sendMessage(composedData);

					if (
						typeof channel.data?.summary !== "string" ||
						!channel.data.summary.length
					) {
						// Skip summarise for now
						// const summary = await summarizeConversation(
						// 	message as string
						// ).catch(() => {
						// 	console.warn("Failed to summarize conversation");
						// 	return null;
						// });
						

						// if (typeof summary === "string" && summary.length > 0) {
						// 	await channel.update({ summary });
						// }
						
					}
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
				<AIMessageComposer.TextInput name="message" />
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
						<AIMessageComposer.SpeechToTextButton />
	</div>

					<AIMessageComposer.SubmitButton active={attachments.length > 0} />
				</div>
			</AIMessageComposer>
		</div>
	);
};
