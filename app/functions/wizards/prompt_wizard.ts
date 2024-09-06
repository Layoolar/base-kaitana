import bot, { WizardContext } from "../telegraf";
import { Composer, Context, Markup, Scenes } from "telegraf";
import { queryAi } from "../queryApi";
import { getBuyPrompt, getCaPrompt, getamountprompt, getSellPrompt } from "../prompt";
import { fetchCoin, getDexPairDataWithAddress, searchDexPairs, sendAllChainData } from "../fetchCoins";
import { TokenData } from "../timePriceData";
// import { json } from "express";
import { conversation } from "../queryApi";
import { isEmpty, processToken, translate } from "../helper";

import { isHoneypot } from "../honeyPot";

import { getUserLanguage } from "../AWSusers";
import { databases } from "@configs/config";
import { pool } from "../actions";
import { updateLog } from "../awslogs";
import { formatNumber } from "../commands";

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
	// @ts-ignore
	const voice = ctx.message.voice;
	const userId = ctx.from?.id;

	if (!userId) {
		return;
	}
	const userLanguage = await getUserLanguage(userId);
	if (voice.duration > 10) {
		ctx.reply(
			{
				english: "Maximum duration is 10 seconds.\n <i> Session exited...</i>",
				french: "La durée maximale est de 10 secondes.",
				spanish: "La duración máxima es de 10 segundos.",
				arabic: "المدة القصوى هي 10 ثوانٍ.",
				chinese: "最长持续时间为10秒。",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}

	if (!ctx.scene.session.promptStore.address) {
		return ctx.reply(
			{
				english: "Please select a token.",
				french: "Veuillez sélectionner un jeton.",
				spanish: "Por favor selecciona un token.",
				arabic: "يرجى اختيار رمز.",
				chinese: "请选择一个代币。",
			}[userLanguage],
		);
	}
	try {
		const output = await pool.exec({ voice, userId });
		ctx.replyWithHTML(
			{
				english: `<b>Audio transcription:</b> ${output}\nIf this isn't what you wanted, use the audio button to record another audio.`,
				french: `<b>Transcription audio :</b> ${output}\nSi ce n'est pas ce que vous vouliez, utilisez le bouton audio pour enregistrer un autre audio.`,
				spanish: `<b>Transcripción de audio:</b> ${output}\nSi esto no es lo que querías, usa el botón de audio para grabar otro audio.`,
				arabic: `<b>نص الصوت:</b> ${output}\nإذا لم يكن هذا ما تريده، استخدم زر الصوت لتسجيل صوت آخر.`,
				chinese: `<b>音频转录:</b> ${output}\n如果这不是您想要的，请使用音频按钮录制另一段音频。`,
			}[userLanguage],
		);

		// console.log(text);

		if (output.toLowerCase() !== "exit") {
			// console.log("here");

			const coinAddress = ctx.scene.session.promptStore.address;
			// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
			const selectedToken = await processToken(coinAddress);
			if (!selectedToken) {
				ctx.reply(
					{
						english:
							"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
						french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
						spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
						arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
						chinese: "我找不到代币，不支持的链或错误的合约地址。",
					}[userLanguage],
				);

				return ctx.scene.leave();
			}

			ctx.scene.session.promptStore.token = selectedToken?.token;
			const data = await getDexPairDataWithAddress(selectedToken.address);

			if (!data) {
				ctx.reply(
					{
						english: "An error occurred, please try again.\n <i> Session exited...</i>",
						french: "Une erreur s'est produite, veuillez réessayer plus tard.",
						spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
						arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
						chinese: "发生错误，请稍后再试。",
					}[userLanguage],
				);

				return ctx.scene.leave();
			}

			const prompt4 = `This is data for a token "${JSON.stringify({
				...selectedToken?.token,
				...data[0],
			})}". use the information provided to answer any question in this "${output}. Reply "This information is unavailable" to any question you can't answer, send your reply in ${userLanguage}"`;

			const detailsCompletionMessage = await conversation(prompt4, ctx.scene.session.promptStore.chatHistory);

			if (detailsCompletionMessage) {
				await ctx.replyWithHTML(
					detailsCompletionMessage,
					Markup.inlineKeyboard([
						Markup.button.callback(
							{
								english: "Exit Session",
								french: "Quitter la session",
								spanish: "Salir de la sesión",
								arabic: "إنهاء الجلسة",
								chinese: "退出会话",
							}[userLanguage],
							"cancel",
						),
						Markup.button.callback(
							{
								english: "Buy",
								french: "Acheter",
								spanish: "Comprar",
								arabic: "شراء",
								chinese: "买",
							}[userLanguage],
							`audiobuy_${selectedToken.address}`,
						),
						Markup.button.callback(
							{
								english: "Sell",
								french: "Vendre",
								spanish: "Vender",
								arabic: "بيع",
								chinese: "卖",
							}[userLanguage],
							`audiosell_${selectedToken.address}`,
						),
					]),
				);

				// console.log(completionMessage);

				ctx.scene.session.promptStore.chatHistory.push(["user", prompt4]);
				ctx.scene.session.promptStore.chatHistory.push(["assistant", detailsCompletionMessage]);

				return;
			}
		}
		await ctx.replyWithHTML(`<b><i>Session Exited...<i></b>
Thank you for using ParrotAI. See you soon.`);

		await ctx.scene.leave();

		//	return await ctx.scene.enter("prompt-wizard", { prompt: output });
	} catch (error) {
		// console.log(error);
		ctx.reply(
			{
				english: "An error occurred, please try again later.",
				french: "Une erreur s'est produite, veuillez réessayer plus tard.",
				spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
				arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
				chinese: "发生错误，请稍后再试。",
			}[userLanguage],
		);

		await ctx.scene.leave();
		return;
	}
	// ctx.wizard.selectStep(1);
};
// start pn group will break bot
// sending auido without selecting language;
// add regx for leavinf only worhs

const cancelFn = async (ctx: WizardContext) => {
	await ctx.replyWithHTML(`<b><i>Session Exited...<i></b>\nThank you for using ParrotAI. See you soon.`);
	return await ctx.scene.leave();
};
const audiobuyFn = async (ctx: WizardContext) => {
	// @ts-ignore
	const coinAddress = ctx.match[1];
	const token = await processToken(coinAddress);
	const userId = ctx.from?.id;
	if (!userId) {
		return;
	}
	const userLanguage = await getUserLanguage(userId);
	if (!token) {
		ctx.reply(
			{
				english:
					"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);

		return ctx.scene.leave();
	}
	const initial = {
		address: coinAddress,
		amount: null,
		token: token,
		time: null,
	};
	// console.log(coinAddress);
	ctx.scene.leave();
	// return ctx.scene.enter("buy-wizard", initial);
	return await ctx.scene.enter("buy-wizard", initial);
	// return;
};

const audiosellFn = async (ctx: WizardContext) => {
	// @ts-ignore
	const coinAddress = ctx.match[1];
	const token = await processToken(coinAddress);
	const userId = ctx.from?.id;

	if (!userId) {
		return;
	}
	const userLanguage = await getUserLanguage(userId);
	if (!token) {
		await ctx.reply(
			{
				english:
					"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
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
		// console.log(ctx.scene.session.promptStore.address);
		const { text } = ctx.message;
		// console.log(text);
		const userId = ctx.from?.id;
		if (!userId) {
			return;
		}

		const userLanguage = await getUserLanguage(userId);
		if (text.toLowerCase() !== "exit") {
			// console.log("here");
			const buyOption = await queryAi(getBuyPrompt(text));
			const sellOption = await queryAi(getSellPrompt(text));
			const buyAmountOption = await queryAi(getamountprompt(text));

			if (buyOption !== "null") {
				return ctx.reply(
					{
						english: "Use the buy button provided above to buy the token.",
						french: "Utilisez le bouton d'achat fourni ci-dessus pour acheter le jeton.",
						spanish: "Utilice el botón de compra proporcionado arriba para comprar el token.",
						arabic: "استخدم زر الشراء المقدم أعلاه لشراء الرمز.",
						chinese: "使用上方提供的购买按钮购买代币。",
					}[userLanguage],
				);
			}
			if (sellOption !== "null") {
				return ctx.reply(
					{
						english: "Use the sell button provided above to sell the token.",
						french: "Utilisez le bouton de vente fourni ci-dessus pour acheter le jeton.",
						spanish: "Utilice el botón de venta proporcionado arriba para comprar el token.",
						arabic: "استخدم زر البيع المقدم أعلاه لشراء الرمز.",
						chinese: "使用上方提供的卖出按钮购买代币。",
					}[userLanguage],
				);
			}

			// const sellAmountOption= await queryAi(getsellAM)

			const coinAddress = ctx.scene.session.promptStore.address;
			// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
			const selectedToken = await processToken(coinAddress);
			if (!selectedToken) {
				await ctx.reply(
					{
						english:
							"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
						french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
						spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
						arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
						chinese: "我找不到代币，不支持的链或错误的合约地址。",
					}[userLanguage],
				);

				return ctx.scene.leave();
			}
			const data = await getDexPairDataWithAddress(selectedToken?.address);

			if (!data) {
				ctx.reply(
					{
						english: "An error occurred, please try again.\n <i> Session exited...</i>",
						french: "Une erreur s'est produite, veuillez réessayer plus tard.",
						spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
						arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
						chinese: "发生错误，请稍后再试。",
					}[userLanguage],
				);

				return ctx.scene.leave();
			}

			ctx.scene.session.promptStore.token = selectedToken?.token;

			const prompt4 = `This is data for a token "${JSON.stringify({
				...selectedToken?.token,
			})}". use the information provided to answer any question in this "${text}. Reply "This information is unavailable" to any question you can't answer, send your reply in ${userLanguage}"`;

			const detailsCompletionMessage = await conversation(prompt4, ctx.scene.session.promptStore.chatHistory);

			if (detailsCompletionMessage) {
				await ctx.replyWithHTML(
					detailsCompletionMessage,
					Markup.inlineKeyboard([
						Markup.button.callback(
							{
								english: "Exit Session",
								french: "Quitter la session",
								spanish: "Salir de la sesión",
								arabic: "إنهاء الجلسة",
								chinese: "退出会话",
							}[userLanguage],
							"cancel",
						),
						Markup.button.callback(
							{
								english: "Buy",
								french: "Acheter",
								spanish: "Comprar",
								arabic: "شراء",
								chinese: "买",
							}[userLanguage],
							`audiobuy_${selectedToken.address}`,
						),
						Markup.button.callback(
							{
								english: "Sell",
								french: "Vendre",
								spanish: "Vender",
								arabic: "بيع",
								chinese: "卖",
							}[userLanguage],
							`audiosell_${selectedToken.address}`,
						),
					]),
				);

				// console.log(completionMessage);

				ctx.scene.session.promptStore.chatHistory.push(["user", prompt4]);
				ctx.scene.session.promptStore.chatHistory.push(["assistant", detailsCompletionMessage]);

				return;
			}
		}
		await ctx.replyWithHTML(`<b><i>Session Exited...<i></b>\nThank you for using ParrotAI. See you soon.`);
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
	const coinAddress = ctx.match[1];
	ctx.scene.session.promptStore.address = coinAddress;

	const res = await processToken(coinAddress);
	// console.log(coinAddress);
	const coin = res?.token;

	const userId = ctx.from?.id;

	if (!userId) {
		return;
	}
	const userLanguage = await getUserLanguage(userId);
	if (!coin) {
		await ctx.reply(
			{
				english:
					"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);

		return ctx.scene.leave();
	}

	if (isEmpty(coin) || !coin.name) {
		return await ctx.reply(
			{
				english:
					"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}

	await updateLog(coinAddress, coin);
	await ctx.replyWithHTML(
		`<b>Getting Token Information...</b>\n\n<b>Token Name: </b><b><i>${coin.name}</i></b>\n<b>Token Address: </b> <code><i>${coin.address}</i></code>`,
	);

	const response2 = `🟢<a href="https://birdeye.so/token/${coin?.address}?chain=${
		res?.chain
	}"><b>${coin.name?.toUpperCase()}</b></a> [${formatNumber(coin.mc)}] $${coin.symbol?.toUpperCase()}
🌐${res.chain.charAt(0).toUpperCase() + res.chain.slice(1)}
💰 USD: <code>$${coin?.price?.toFixed(7)}</code>
💎FDV: <code>${formatNumber(coin?.mc)}</code>
💦 Liq: <code>${formatNumber(coin?.liquidity)}</code>
📈 1hr: ${coin?.priceChange1hPercent ? `${coin.priceChange1hPercent?.toFixed(2)}%` : "N/A"}
📉 24h: ${coin?.priceChange8hPercent ? `${coin.priceChange8hPercent?.toFixed(2)}%` : "N/A"}

<code>${coin?.address}</code>
`;

	await ctx.replyWithHTML(
		response2,
		Markup.inlineKeyboard([
			Markup.button.callback(
				{
					english: "Exit Session",
					french: "Quitter la session",
					spanish: "Salir de la sesión",
					arabic: "إنهاء الجلسة",
					chinese: "退出会话",
				}[userLanguage],
				"cancel",
			),
			Markup.button.callback(
				{
					english: "Buy",
					french: "Acheter",
					spanish: "Comprar",
					arabic: "شراء",
					chinese: "买",
				}[userLanguage],
				`audiobuy_${coin.address}`,
			),
			Markup.button.callback(
				{
					english: "Sell",
					french: "Vendre",
					spanish: "Vender",
					arabic: "بيع",
					chinese: "卖",
				}[userLanguage],
				`audiosell_${coin.address}`,
			),
		]),
	);
	// console.log(honeyPotRes);

	ctx.wizard.next();
});

// stepHandler1.on("text", async (ctx)=>{});
export const promptWizard = new Scenes.WizardScene<WizardContext>(
	"prompt-wizard",
	async (ctx) => {
		ctx.scene.session.promptStore = JSON.parse(JSON.stringify(initialData));
		// console.log("heretoo");
		const userId = ctx.from?.id;
		if (!userId) {
			return;
		}
		// @ts-ignore
		ctx.scene.session.promptStore.prompt = ctx.scene.state.prompt.trim();

		ctx.scene.session.promptStore.language = await getUserLanguage(userId);
		const userLanguage = await getUserLanguage(userId);
		// console.log(ctx.scene.session.promptStore.prompt);
		// const userLanguage = ctx.scene.session.promptStore.language;
		if (ctx.scene.session.promptStore.prompt.length === 0) {
			ctx.reply(
				{
					english: "Your audio is empty, please try again.\n <i> Session exited...</i>",
					french: "Votre audio est vide, veuillez réessayer.",
					spanish: "Tu audio está vacío, por favor inténtalo de nuevo.",
					arabic: "الصوت فارغ، يرجى المحاولة مرة أخرى.",
					chinese: "您的音频是空的，请重试。",
				}[userLanguage],
			);

			return ctx.scene.leave();
		}

		const results = await searchDexPairs(ctx.scene.session.promptStore.prompt);
		if (!results || results?.length === 0) {
			// ctx.reply("An error occurred, Please try again");
			return ctx.scene.leave();
		}
		// console.log("here", results);
		//	ctx.replyWithHTML(`<b>Your Query:</b> ${ctx.scene.session.promptStore.prompt}`);
		for (let index = 0; index < (results.length > 4 ? 4 : results.length); index++) {
			const result = results[index];

			await ctx.replyWithHTML(
				`<b>🧿Name:</b> ${result.name}\n<b>📗CA:</b> ${result.address}\n<b>🌐Chain:</b> ${
					result.chain
				}\n<b>💎Mcap:</b> $${result.mcap.toLocaleString()}`,

				Markup.inlineKeyboard([
					[
						Markup.button.callback(
							{
								english: "Details",
								french: "Détails",
								spanish: "Detalles",
								arabic: "تفاصيل",
								chinese: "详情",
							}[userLanguage],
							`details_${result.address}`,
						),
						Markup.button.callback(
							{
								english: "Buy",
								french: "Acheter",
								spanish: "Comprar",
								arabic: "شراء",
								chinese: "买",
							}[userLanguage],
							`audiobuy_${result.address}`,
						),
						Markup.button.callback(
							{
								english: "Sell",
								french: "Vendre",
								spanish: "Vender",
								arabic: "بيع",
								chinese: "卖",
							}[userLanguage],
							`audiosell_${result.address}`,
						),
					],
					[
						Markup.button.callback(
							{
								english: "Exit Session",
								french: "Quitter la session",
								spanish: "Salir de la sesión",
								arabic: "إنهاء الجلسة",
								chinese: "退出会话",
							}[userLanguage],
							"cancel",
						),
					],
				]),
			);
		}
		ctx.replyWithHTML(
			{
				english: `<b>Audio transcription:</b> ${ctx.scene.session.promptStore.prompt}\nIf this isn't what you wanted, exit the current session and use the audio button to record another audio.`,
				french: `<b>Transcription audio :</b> ${ctx.scene.session.promptStore.prompt}\nSi ce n'est pas ce que vous vouliez, quittez la session en cours et utilisez le bouton audio pour enregistrer un autre audio.`,
				spanish: `<b>Transcripción de audio:</b> ${ctx.scene.session.promptStore.prompt}\nSi esto no es lo que querías, sal de la sesión actual y usa el botón de audio para grabar otro audio.`,
				arabic: `<b>نص الصوت:</b> ${ctx.scene.session.promptStore.prompt}\nإذا لم يكن هذا ما تريده، اخرج من الجلسة الحالية واستخدم زر الصوت لتسجيل صوت آخر.`,
				chinese: `<b>音频转录:</b> ${ctx.scene.session.promptStore.prompt}\n如果这不是您想要的，请退出当前会话并使用音频按钮录制另一段音频。`,
			}[userLanguage],
			Markup.inlineKeyboard([
				[
					Markup.button.callback(
						{
							english: "Exit Session",
							french: "Quitter la session",
							spanish: "Salir de la sesión",
							arabic: "إنهاء الجلسة",
							chinese: "退出会话",
						}[userLanguage],
						"cancel",
					),
				],
			]),
		);

		// .action("cancel", cancelFn);
		// console.log(ctx.scene.session.promptStore.prompt.trim().length === 0);
		return ctx.wizard.next();
	},
	stepHandler1,
	stepHandler2,
);
