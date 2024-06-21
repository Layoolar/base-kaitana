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
import { databases } from "@configs/config";

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

	if (!userId) return;
	const userLanguage = getUserLanguage(userId);
	if (voice.duration > 10) {
		return ctx.reply(
			{
				english: "Maximum duration is 10 seconds.",
				french: "La durée maximale est de 10 secondes.",
				spanish: "La duración máxima es de 10 segundos.",
				arabic: "المدة القصوى هي 10 ثوانٍ.",
				chinese: "最长持续时间为10秒。",
			}[userLanguage],
		);
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
		const filePath = await downloadFile(voice.file_id, userId);
		const transcription = await transcribeAudio(filePath);

		const output = transcription.replace(/[-.,]/g, "");

		//ctx.reply(`${output}`);
		//const aiResponse=await queryAi( getTrancribedAudioPrompt( transcription))
		//ctx.wizard.next();
		deleteFile(filePath);
		ctx.replyWithHTML(
			{
				english: `<b>Audio transcription:</b> ${output}\nIf this isn't what you wanted, use the audio button to record another audio.`,
				french: `<b>Transcription audio :</b> ${output}\nSi ce n'est pas ce que vous vouliez, utilisez le bouton audio pour enregistrer un autre audio.`,
				spanish: `<b>Transcripción de audio:</b> ${output}\nSi esto no es lo que querías, usa el botón de audio para grabar otro audio.`,
				arabic: `<b>نص الصوت:</b> ${output}\nإذا لم يكن هذا ما تريده، استخدم زر الصوت لتسجيل صوت آخر.`,
				chinese: `<b>音频转录:</b> ${output}\n如果这不是您想要的，请使用音频按钮录制另一段音频。`,
			}[userLanguage],
		);

		//console.log(text);

		if (output.toLowerCase() !== "exit") {
			//console.log("here");

			const coinAddress = ctx.scene.session.promptStore.address;
			// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
			let selectedToken = await processToken(coinAddress);
			if (!selectedToken) {
				ctx.reply(
					{
						english: "I couldn't find the token, unsupported chain, or wrong contract address.",
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
						english: "An error occurred, please try again later.",
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
			})}". use the information provided to answer any question in this "${output}. Reply "This information is unavailable" to any question you can't answer, send your reply in ${getUserLanguage(
				ctx.from.id,
			)}"`;

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
								english: "buy",
								french: "acheter",
								spanish: "comprar",
								arabic: "شراء",
								chinese: "买",
							}[userLanguage],
							`audiobuy_${selectedToken.address}`,
						),
						Markup.button.callback(
							{
								english: "sell",
								french: "vendre",
								spanish: "vender",
								arabic: "بيع",
								chinese: "卖",
							}[userLanguage],
							`audiosell_${selectedToken.address}`,
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
		if (exitMessage)
			await ctx.replyWithHTML(
				userLanguage === "english" ? exitMessage : await translate(exitMessage, userLanguage),
			);

		await ctx.scene.leave();

		//	return await ctx.scene.enter("prompt-wizard", { prompt: output });
	} catch (error) {
		//console.log(error);
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
	//ctx.wizard.selectStep(1);
};

const cancelFn = async (ctx: WizardContext) => {
	const userLanguage = ctx.scene.session.promptStore.language;
	if (!userLanguage) {
		return;
	}
	const exitMessage = await conversation("exit", ctx.scene.session.promptStore.chatHistory);
	if (exitMessage)
		await ctx.replyWithHTML(userLanguage === "english" ? exitMessage : await translate(exitMessage, userLanguage));

	return await ctx.scene.leave();
};
const audiobuyFn = async (ctx: WizardContext) => {
	//@ts-ignore
	const coinAddress = ctx.match[1];
	const token = await processToken(coinAddress);
	const userId = ctx.from?.id;
	if (!userId) return;
	const userLanguage = getUserLanguage(userId);
	if (!token) {
		ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
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
	//console.log(coinAddress);
	ctx.scene.leave();
	//return ctx.scene.enter("buy-wizard", initial);
	return await ctx.scene.enter("buy-wizard", initial);
	//return;
};

const audiosellFn = async (ctx: WizardContext) => {
	//@ts-ignore
	const coinAddress = ctx.match[1];
	const token = await processToken(coinAddress);
	const userId = ctx.from?.id;

	if (!userId) return;
	const userLanguage = getUserLanguage(userId);
	if (!token) {
		await ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
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
		//console.log(ctx.scene.session.promptStore.address);
		const { text } = ctx.message;
		//console.log(text);
		const userId = ctx.from?.id;
		if (!userId) return;
		const userLanguage = getUserLanguage(userId);
		if (text.toLowerCase() !== "exit") {
			//console.log("here");

			const coinAddress = ctx.scene.session.promptStore.address;
			// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
			let selectedToken = await processToken(coinAddress);
			if (!selectedToken) {
				await ctx.reply(
					{
						english: "I couldn't find the token, unsupported chain, or wrong contract address.",
						french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
						spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
						arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
						chinese: "我找不到代币，不支持的链或错误的合约地址。",
					}[userLanguage],
				);

				return ctx.scene.leave();
			}
			const data = await getDexPairDataWithAddress(selectedToken.address);

			if (!data) {
				ctx.reply(
					{
						english: "An error occurred, please try again later.",
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
				...data[0],
			})}". use the information provided to answer any question in this "${text}. Reply "This information is unavailable" to any question you can't answer, send your reply in ${getUserLanguage(
				ctx.from.id,
			)}"`;

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
								english: "buy",
								french: "acheter",
								spanish: "comprar",
								arabic: "شراء",
								chinese: "买",
							}[userLanguage],
							`audiobuy_${selectedToken.address}`,
						),
						Markup.button.callback(
							{
								english: "sell",
								french: "vendre",
								spanish: "vender",
								arabic: "بيع",
								chinese: "卖",
							}[userLanguage],
							`audiosell_${selectedToken.address}`,
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
	const coinAddress = ctx.match[1];
	ctx.scene.session.promptStore.address = coinAddress;

	const res = await processToken(coinAddress);
	//console.log(coinAddress);
	const coin = res?.token;

	const userId = ctx.from?.id;

	if (!userId) return;
	const userLanguage = getUserLanguage(userId);
	if (!coin) {
		await ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
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
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}

	const data = await getDexPairDataWithAddress(coin.address);

	if (!data) {
		ctx.reply(
			{
				english: "An error occurred, please try again later.",
				french: "Une erreur s'est produite, veuillez réessayer plus tard.",
				spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
				arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
				chinese: "发生错误，请稍后再试。",
			}[userLanguage],
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
		{
			english:
				'<b>"Getting Token Information...</b>\\n\\n<b>Token Name: </b><i>${coin.name}</i>\\n<b>Token Address: </b> <i>${coin.address}</i>',
			french: '<b>"Obtention des informations sur le jeton...</b>\\n\\n<b>Nom du jeton : </b><i>${coin.name}</i>\\n<b>Adresse du jeton : </b> <i>${coin.address}</i>',
			spanish:
				'<b>"Obteniendo información del token...</b>\\n\\n<b>Nombre del token: </b><i>${coin.name}</i>\\n<b>Dirección del token: </b> <i>${coin.address}</i>',
			arabic: '<b>"الحصول على معلومات الرمز...</b>\\n\\n<b>اسم الرمز: </b><i>${coin.name}</i>\\n<b>عنوان الرمز: </b> <i>${coin.address}</i>',
			chinese:
				'<b>"获取代币信息...</b>\\n\\n<b>代币名称: </b><i>${coin.name}</i>\\n<b>代币地址: </b> <i>${coin.address}</i>',
		}[userLanguage],
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
					english: "buy",
					french: "acheter",
					spanish: "comprar",
					arabic: "شراء",
					chinese: "买",
				}[userLanguage],
				`audiobuy_${coin.address}`,
			),
			Markup.button.callback(
				{
					english: "sell",
					french: "vendre",
					spanish: "vender",
					arabic: "بيع",
					chinese: "卖",
				}[userLanguage],
				`audiosell_${coin.address}`,
			),
			,
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
		const userLanguage = getUserLanguage(userId);
		//console.log(ctx.scene.session.promptStore.prompt);
		//const userLanguage = ctx.scene.session.promptStore.language;
		if (ctx.scene.session.promptStore.prompt.length === 0) {
			ctx.reply(
				{
					english: "Your audio is empty, please try again.",
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
							english: "buy",
							french: "acheter",
							spanish: "comprar",
							arabic: "شراء",
							chinese: "买",
						}[userLanguage],
						`audiobuy_${result.address}`,
					),
					Markup.button.callback(
						{
							english: "sell",
							french: "vendre",
							spanish: "vender",
							arabic: "بيع",
							chinese: "卖",
						}[userLanguage],
						`audiosell_${result.address}`,
					),
				]),
			);
		}
		ctx.replyWithHTML(
			{
				english: `<b>Audio transcription:</b> ${ctx.scene.session.promptStore.prompt}\nIf this isn't what you wanted, use the audio button to record another audio.`,
				french: `<b>Transcription audio :</b> ${ctx.scene.session.promptStore.prompt}\nSi ce n'est pas ce que vous vouliez, utilisez le bouton audio pour enregistrer un autre audio.`,
				spanish: `<b>Transcripción de audio:</b> ${ctx.scene.session.promptStore.prompt}\nSi esto no es lo que querías, usa el botón de audio para grabar otro audio.`,
				arabic: `<b>نص الصوت:</b> ${ctx.scene.session.promptStore.prompt}\nإذا لم يكن هذا ما تريده، استخدم زر الصوت لتسجيل صوت آخر.`,
				chinese: `<b>音频转录:</b> ${ctx.scene.session.promptStore.prompt}\n如果这不是您想要的，请使用音频按钮录制另一段音频。`,
			}[getUserLanguage(userId)],
		);
		//console.log(ctx.scene.session.promptStore.prompt.trim().length === 0);
		return ctx.wizard.next();
	},
	stepHandler1,
	stepHandler2,
);
