import { WizardContext } from "@app/functions/telegraf";
import { Composer, Context, Markup, Scenes } from "telegraf";
import { queryAi } from "../queryApi";
import { getBuyPrompt, getCaPrompt, getamountprompt } from "../prompt";
import { fetchCoin, getDexPairDataWithAddress, searchDexPairs, sendAllChainData } from "../fetchCoins";
import { TokenData } from "../timePriceData";
import { json } from "express";
import { conversation } from "../queryApi";
import { isEmpty, processToken, translate } from "../helper";
import { deleteFile, downloadFile, transcribeAudio } from "../helper";
import { isHoneypot } from "../honeyPot";
import { getUserLanguage } from "../databases";

const initialData = {
	prompt: "",
	address: null,
	token: undefined,
	chain: "",
	chatHistory: [],
	language: null,
};

const stepHandler1 = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

const getVoice = async (ctx: WizardContext) => {
	//@ts-ignore
	const voice = ctx.message.voice;
	const userId = ctx.from?.id;
	const userLanguage = ctx.scene.session.promptStore.language;
	if (!userLanguage) {
		return;
	}

	if (!userId) return;
	if (voice.duration > 10) {
		return ctx.reply(
			userLanguage === "english"
				? "Maximum duration is 10 seconds"
				: await translate("Maximum duration is 10 seconds", userLanguage),
		);
	}

	if (!ctx.scene.session.promptStore.address) {
		return ctx.reply(
			userLanguage === "english"
				? "Please select a token"
				: await translate("Please select a token", userLanguage),
		);
	}
	try {
		const filePath = await downloadFile(voice.file_id, userId);
		const transcription = await transcribeAudio(filePath);

		const output = transcription.replace(/[-.,]/g, "");

		//ctx.reply(`${output}`);
		//const aiResponse=await queryAi( getTrancribedAudioPrompt( transcription))
		//ctx.wizard.next();
		deleteFile(filePath);
		ctx.replyWithHTML(
			await translate(
				`<b>Audio transcription:</b> ${output}\nIf this isn't what you wanted, use the audio button can record another audio`,
				userLanguage,
			),
		);

		//console.log(text);

		if (output.toLowerCase() !== "exit") {
			//console.log("here");

			const coinAddress = ctx.scene.session.promptStore.address;
			// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
			let selectedToken = await processToken(coinAddress);
			if (!selectedToken) {
				ctx.reply(
					userLanguage === "english"
						? "I couldn't find the token, unsupported chain or wrong contract address."
						: await translate(
								"I couldn't find the token, unsupported chain or wrong contract address.",
								userLanguage,
						  ),
				);

				return ctx.scene.leave();
			}

			ctx.scene.session.promptStore.token = selectedToken?.token;

			const prompt4 = `This is data for a token "${JSON.stringify(
				selectedToken?.token,
			)}". use the information provided to answer any question in this "${output}. Reply "This information is unavailable" to any question you can't answer, send your reply in ${getUserLanguage(
				ctx.from.id,
			)}"`;

			const detailsCompletionMessage = await conversation(prompt4, ctx.scene.session.promptStore.chatHistory);

			if (detailsCompletionMessage) {
				await ctx.replyWithHTML(
					detailsCompletionMessage,
					Markup.inlineKeyboard([
						Markup.button.callback("Exit Session", "cancel"),
						Markup.button.callback("Buy", "buy"),
						Markup.button.callback("Sell", "sell"),
					]),
				);

				//console.log(completionMessage);

				ctx.scene.session.promptStore.chatHistory.push(["user", prompt4]);
				ctx.scene.session.promptStore.chatHistory.push(["assistant", detailsCompletionMessage]);

				return;
			}
		}
		const exitMessage = await conversation("exit", ctx.scene.session.promptStore.chatHistory);
		if (exitMessage) await ctx.replyWithHTML(exitMessage);
		await ctx.scene.leave();

		//	return await ctx.scene.enter("prompt-wizard", { prompt: output });
	} catch (error) {
		//console.log(error);
		return ctx.reply(
			userLanguage === "english"
				? "An error occurred, please try again"
				: await translate("An error occurred, please try again", userLanguage),
		);

		await ctx.scene.leave();
		return;
	}
	//ctx.wizard.selectStep(1);
};

const cancelFn = async (ctx: WizardContext) => {
	const userLanguage = ctx.scene.session.promptStore.language;
	if (!userLanguage) {
		return;
	}
	const exitMessage = await conversation("exit", ctx.scene.session.promptStore.chatHistory);
	if (exitMessage) await ctx.replyWithHTML(exitMessage);

	return await ctx.scene.leave();
};
const audiobuyFn = async (ctx: WizardContext) => {
	const userLanguage = ctx.scene.session.promptStore.language;
	if (!userLanguage) {
		return;
	}
	//@ts-ignore
	const coinAddress = ctx.match[1];
	const token = await processToken(coinAddress);
	const userId = ctx.from?.id;
	if (!userId) return;
	if (!token) {
		ctx.reply(
			userLanguage === "english"
				? "I couldn't find the token, unsupported chain or wrong contract address."
				: await translate(
						"I couldn't find the token, unsupported chain or wrong contract address.",
						userLanguage,
				  ),
		);

		return ctx.scene.leave();
	}
	const initial = {
		address: coinAddress,
		amount: null,
		token: token,
		time: null,
	};
	//console.log(coinAddress);
	ctx.scene.leave();
	//return ctx.scene.enter("buy-wizard", initial);
	return await ctx.scene.enter("buy-wizard", initial);
	//return;
};

const audiosellFn = async (ctx: WizardContext) => {
	const userLanguage = ctx.scene.session.promptStore.language;
	if (!userLanguage) {
		return;
	}
	//@ts-ignore
	const coinAddress = ctx.match[1];
	const token = await processToken(coinAddress);
	const userId = ctx.from?.id;
	if (!userId) return;
	if (!token) {
		await ctx.reply(
			userLanguage === "english"
				? "I couldn't find the token, unsupported chain or wrong contract address."
				: await translate(
						"I couldn't find the token, unsupported chain or wrong contract address.",
						userLanguage,
				  ),
		);
		return ctx.scene.leave();
	}
	const initial = {
		address: coinAddress,
		amount: null,
		token: token,
		time: null,
	};

	ctx.scene.leave();

	return await ctx.scene.enter("sell-wizard", initial);
};
const getText = async (ctx: WizardContext) => {
	if (ctx.message && "text" in ctx.message) {
		const userLanguage = ctx.scene.session.promptStore.language;
		if (!userLanguage) {
			return;
		}
		//console.log(ctx.scene.session.promptStore.address);
		const { text } = ctx.message;
		//console.log(text);
		const userId = ctx.from?.id;
		if (!userId) return;
		if (text.toLowerCase() !== "exit") {
			//console.log("here");

			const coinAddress = ctx.scene.session.promptStore.address;
			// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
			let selectedToken = await processToken(coinAddress);
			if (!selectedToken) {
				await ctx.reply(
					userLanguage === "english"
						? "I couldn't find the token, unsupported chain or wrong contract address."
						: await translate(
								"I couldn't find the token, unsupported chain or wrong contract address.",
								userLanguage,
						  ),
				);

				return ctx.scene.leave();
			}

			ctx.scene.session.promptStore.token = selectedToken?.token;

			const prompt4 = `This is data for a token "${JSON.stringify(
				selectedToken?.token,
			)}". use the information provided to answer any question in this "${text}. Reply "This information is unavailable" to any question you can't answer, send your reply in ${getUserLanguage(
				ctx.from.id,
			)}"`;

			const detailsCompletionMessage = await conversation(prompt4, ctx.scene.session.promptStore.chatHistory);

			if (detailsCompletionMessage) {
				await ctx.replyWithHTML(
					detailsCompletionMessage,
					Markup.inlineKeyboard([
						Markup.button.callback(
							userLanguage === "english" ? "Exit Session" : await translate("Exit Session", userLanguage),
							"cancel",
						),
						Markup.button.callback(
							userLanguage === "english" ? "Buy" : await translate("Buy", userLanguage),
							"buy",
						),
						Markup.button.callback(
							userLanguage === "english" ? "Sell" : await translate("Sell", userLanguage),
							"sell",
						),
					]),
				);

				//console.log(completionMessage);

				ctx.scene.session.promptStore.chatHistory.push(["user", prompt4]);
				ctx.scene.session.promptStore.chatHistory.push(["assistant", detailsCompletionMessage]);

				return;
			}
		}
		const exitMessage = await conversation("exit", ctx.scene.session.promptStore.chatHistory);
		if (exitMessage) await ctx.replyWithHTML(exitMessage);
		await ctx.scene.leave();
	}
};
stepHandler1.on("voice", getVoice);
stepHandler1.action("cancel", cancelFn);
stepHandler1.action(/audiobuy_(.+)/, audiobuyFn);
stepHandler1.action(/audiosell_(.+)/, audiosellFn);

stepHandler2.action("cancel", cancelFn);
stepHandler2.action(/audiobuy_(.+)/, audiobuyFn);
stepHandler2.action(/audiosell_(.+)/, audiosellFn);
stepHandler2.on("text", getText);
stepHandler2.on("voice", getVoice);
stepHandler1.action(/details_(.+)/, async (ctx) => {
	const userLanguage = ctx.scene.session.promptStore.language;
	if (!userLanguage) {
		return;
	}
	const coinAddress = ctx.match[1];
	ctx.scene.session.promptStore.address = coinAddress;

	const res = await processToken(coinAddress);
	//console.log(coinAddress);
	const coin = res?.token;

	const userId = ctx.from?.id;

	if (!userId) return;
	if (!coin) {
		await ctx.reply(
			userLanguage === "english"
				? "I couldn't find the token, unsupported chain or wrong contract address."
				: await translate(
						"I couldn't find the token, unsupported chain or wrong contract address.",
						userLanguage,
				  ),
		);

		return ctx.scene.leave();
	}

	if (isEmpty(coin) || !coin.name) {
		return await ctx.reply(
			userLanguage === "english"
				? "I couldn't find the token, please check the contract address and try again."
				: await translate(
						"I couldn't find the token, please check the contract address and try again.",
						userLanguage,
				  ),
		);
	}

	const data = await getDexPairDataWithAddress(coin.address);

	if (!data) {
		ctx.reply(
			userLanguage === "english"
				? "An error occurred, please try again"
				: await translate("An error occurred, please try again", userLanguage),
		);

		return ctx.scene.leave();
	}

	let honeyPotRes;

	const validChains = ["etheruem", "bsc", "base"];
	if (validChains.includes(data[0].chain.toLowerCase())) {
		honeyPotRes = await isHoneypot(coin.address);
	}

	//console.log(honeyPotRes);
	await ctx.replyWithHTML(
		`<b>${await translate("Getting Token Information...", userLanguage)}</b>\n\n<b>Token Name: </b><i>${
			coin.name
		}</i>\n<b>Token Address: </b> <i>${coin.address}</i>`,
	);
	const response = await queryAi(
		`This is a data response a token. Give a summary of the important information provided here ${JSON.stringify({
			...coin,
			...data[0],
		})}. Don't make mention that you are summarizing a given data in your response. Don't say things like 'According to the data provided'. Send the summary back in few short paragraphs. Only return the summary and nothing else. Also wrap important values with HTML <b> bold tags,
				make the numbers easy for humans to read with commas and add a lot of emojis to your summary to make it aesthetically pleasing, for example add 💰 to price, 💎 to mcap,💦 to liquidity,📊 to volume,⛰to Ath, 📈 to % increase ,📉 to % decrease, reply in ${getUserLanguage(
					userId,
				)}`,
	);

	await ctx.replyWithHTML(
		response,
		Markup.inlineKeyboard([
			Markup.button.callback(
				userLanguage === "english" ? "Exit Session" : await translate("Exit Session", userLanguage),
				"cancel",
			),
			Markup.button.callback(userLanguage === "english" ? "Buy" : await translate("Buy", userLanguage), "buy"),
			Markup.button.callback(userLanguage === "english" ? "Sell" : await translate("Sell", userLanguage), "sell"),
		]),
	);
	//console.log(honeyPotRes);
	if (honeyPotRes)
		await ctx.replyWithHTML(
			`<b>🛡Rug Check</b>\n\n<b>Risk Level:</b> ${honeyPotRes.summary.risk}\n<b>isHoneyPot:</b> ${
				honeyPotRes.honeypot.isHoneypot ? "Yes ❌" : "No ✅"
			}\n<b>Flags:</b> ${honeyPotRes.flags.length === 0 ? "None" : honeyPotRes.flags.join(", ")}`,
		);

	ctx.wizard.next();
});

// stepHandler1.on("text", async (ctx)=>{});
export const promptWizard = new Scenes.WizardScene<WizardContext>(
	"prompt-wizard",
	async (ctx) => {
		ctx.scene.session.promptStore = JSON.parse(JSON.stringify(initialData));
		//console.log("heretoo");
		const userId = ctx.from?.id;
		if (!userId) return;
		//@ts-ignore
		ctx.scene.session.promptStore.prompt = ctx.scene.state.prompt.trim();

		ctx.scene.session.promptStore.language = getUserLanguage(userId);
		//console.log(ctx.scene.session.promptStore.prompt);
		const userLanguage = ctx.scene.session.promptStore.language;
		if (ctx.scene.session.promptStore.prompt.length === 0) {
			ctx.reply(
				userLanguage === "english"
					? "Your audio is empty, please try again"
					: await translate("Your audio is empty, please try again", userLanguage),
			);

			return ctx.scene.leave();
		}

		const results = await searchDexPairs(ctx.scene.session.promptStore.prompt);
		if (!results || results?.length === 0) {
			//ctx.reply("An error occurred, Please try again");
			return ctx.scene.leave();
		}
		//console.log("here", results);
		//	ctx.replyWithHTML(`<b>Your Query:</b> ${ctx.scene.session.promptStore.prompt}`);
		for (let index = 0; index < (results.length > 4 ? 4 : results.length); index++) {
			const result = results[index];

			await ctx.replyWithHTML(
				`<b>🧿Name:</b> ${result.name}\n<b>📗CA:</b> ${result.address}\n<b>🌐Chain:</b> ${
					result.chain
				}\n<b>💎Mcap:</b> $${result.mcap.toLocaleString()}`,

				Markup.inlineKeyboard([
					Markup.button.callback(
						userLanguage === "english" ? "Details" : await translate("Details", userLanguage),
						`details_${result.address}`,
					),
					Markup.button.callback(
						userLanguage === "english" ? "Buy" : await translate("Buy", userLanguage),
						`audiobuy_${result.address}`,
					),
					Markup.button.callback(
						userLanguage === "english" ? "Sell" : await translate("Sell", userLanguage),
						`audiosell_${result.address}`,
					),
				]),
			);
		}
		ctx.replyWithHTML(
			`<b>${translate("Audio transcription", userLanguage)}:</b> ${
				ctx.scene.session.promptStore.prompt
			}\n ${await translate(
				"If this isn't what you wanted, use the audio button can record another audio",
				userLanguage,
			)}`,
		);
		//console.log(ctx.scene.session.promptStore.prompt.trim().length === 0);
		return ctx.wizard.next();
	},
	stepHandler1,
	stepHandler2,
);
