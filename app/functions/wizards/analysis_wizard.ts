import { WizardContext } from "../telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";
import { fetchCoin } from "../fetchCoins";
import { TokenData, generateTimeAndPriceGraph } from "../timePriceData";
import { toUnicode } from "punycode";
import { fetchOHLCVData } from "../fetchCandlestickData";
import { isEmpty, processToken } from "../helper";
import { getUserLanguage } from "../AWSusers";

const initialData = {
	address: "",
	chain: "",
	token: undefined,
	type: "",
};

const stepHandler = new Composer<WizardContext>();

// stepHandler.action(/token_(.+)/, async (ctx) => {
// 	const tokenName = ctx.match[1];
// 	const bsctoken = (await fetchCoin(ctx.scene.session.analysisStore.address, "bsc")) as TokenData;
// 	const ethtoken = (await fetchCoin(ctx.scene.session.analysisStore.address, "ethereum")) as TokenData;
// 	if (tokenName === ethtoken.name) {
// 		ctx.scene.session.analysisStore.token = ethtoken;
// 		ctx.scene.session.analysisStore.chain = "ethereum";
// 	} else {
// 		ctx.scene.session.analysisStore.token = bsctoken;
// 		ctx.scene.session.analysisStore.chain = "bsc";
// 	}
// 	await ctx.reply(
// 		`What type of analysis would you prefer for the token ${ctx.scene.session.analysisStore.token?.name}`,
// 		Markup.inlineKeyboard([
// 			Markup.button.callback(`AI percentage price change analysis`, `type_percentage`),
// 			Markup.button.callback(` AI Candle Stick data analysis`, `type_candlestick`),
// 		]),
// 	);

// 	return ctx.wizard.next();
// });

stepHandler.action(/timeframe_(.+)/, async (ctx) => {
	//console.log("in here");
	const userid = ctx.from?.id;
	if (!userid) return;
	const userLanguage = await getUserLanguage(userid);

	await ctx.reply(
		{
			english: `Performing analysis for ${ctx.scene.session.analysisStore.token?.name} with address ${ctx.scene.session.analysisStore.address} ...`,
			french: `Analyse en cours pour ${ctx.scene.session.analysisStore.token?.name} avec l'adresse ${ctx.scene.session.analysisStore.address} ...`,
			spanish: `Realizando análisis para ${ctx.scene.session.analysisStore.token?.name} con dirección ${ctx.scene.session.analysisStore.address} ...`,
			arabic: `جارٍ إجراء التحليل لـ ${ctx.scene.session.analysisStore.token?.name} بعنوان ${ctx.scene.session.analysisStore.address} ...`,
			chinese: `正在对 ${ctx.scene.session.analysisStore.token?.name} 进行分析，地址为 ${ctx.scene.session.analysisStore.address} ...`,
		}[userLanguage],
	);
	const startTime = Math.floor((Date.now() - 12 * 24 * 60 * 60 * 1000) / 1000);

	const endTime = Math.floor(Date.now() / 1000);
	const timeframe = ctx.match[1];
	const data = await fetchOHLCVData(
		ctx.scene.session.analysisStore.address,

		timeframe,
		startTime,
		endTime,
		ctx.scene.session.analysisStore.chain,
	);
	const analysisPromptCandle = `Below are the candlestick(OHLCV) data of a token's prices in diffrent intervals... Identify market trends or indicators and use that data to predict maybe the token will go up or down...


You must choose out of up or down and give reason, make it conversational

 this is the data ${data}.`;
	if (!data) {
		ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}
	ctx.reply(await queryAi(`${analysisPromptCandle} Reply in ${userLanguage}`));
	ctx.answerCbQuery();
	return ctx.scene.leave();
});

stepHandler.action(/type_(.+)/, async (ctx) => {
	const type = ctx.match[1];
	const userid = ctx.from?.id;
	if (!userid) return;
	const userLanguage = await getUserLanguage(userid);
	if (type === "candlestick") {
		await ctx.reply(
			{
				english: "Choose the timeframe for the analysis:",
				french: "Choisissez la période pour l'analyse :",
				spanish: "Elige el marco de tiempo para el análisis:",
				arabic: "اختر الإطار الزمني للتحليل:",
				chinese: "选择分析的时间范围：",
			}[userLanguage],
			Markup.inlineKeyboard([
				Markup.button.callback("1m", "timeframe_1m"),
				Markup.button.callback("5m", "timeframe_5m"),
				Markup.button.callback("15m", "timeframe_15m"),
				Markup.button.callback("30m", "timeframe_30m"),
				Markup.button.callback("1H", "timeframe_1H"),
				Markup.button.callback("4H", "timeframe_4H"),
				Markup.button.callback("1D", "timeframe_1D"),
				Markup.button.callback(
					{
						english: "Cancel",
						french: "Annuler",
						spanish: "Cancelar",
						arabic: "إلغاء",
						chinese: "取消",
					}[userLanguage],
					"cancel",
				),
			]),
		);
		ctx.answerCbQuery();
		return ctx.wizard.next();
	} else {
		const analysisPrompt = `Below are the time changes of a token's prices in diffrent intervals... Identify market trends or indicators and use that data to predict maybe the token will go up or down...


You must choose out of up or down and give reason, make it conversational

 this is the data`;
		const coinData = await fetchCoin(
			ctx.scene.session.analysisStore.address,
			ctx.scene.session.analysisStore.chain?.toLowerCase(),
		);
		if (!coinData) {
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
		await ctx.reply(
			{
				english: `Performing analysis for ${coinData.name} with address ${ctx.scene.session.analysisStore.address} ...`,
				french: `Analyse en cours pour ${coinData.name} avec l'adresse ${ctx.scene.session.analysisStore.address} ...`,
				spanish: `Realizando análisis para ${coinData.name} con dirección ${ctx.scene.session.analysisStore.address} ...`,
				arabic: `جارٍ إجراء التحليل لـ ${coinData.name} بعنوان ${ctx.scene.session.analysisStore.address} ...`,
				chinese: `正在对 ${coinData.name} 进行分析，地址为 ${ctx.scene.session.analysisStore.address} ...`,
			}[userLanguage],
		);
		const aiAnalysis = await queryAi(`${analysisPrompt} ${JSON.stringify(coinData)}. reply in ${userLanguage}`);
		await ctx.reply(aiAnalysis);
		ctx.answerCbQuery();
		return ctx.scene.leave();
	}
});

stepHandler.action("cancel", async (ctx) => {
	if (!ctx.from?.id) return;

	const userLanguage = await getUserLanguage(ctx.from.id);
	await ctx.reply(
		{
			english: "You've cancelled the operation",
			french: "Vous avez annulé l'opération",
			spanish: "Has cancelado la operación",
			arabic: "لقد قمت بإلغاء العملية",
			chinese: "您已取消操作",
		}[userLanguage],
	);
	ctx.answerCbQuery();
	return await ctx.scene.leave();
});
stepHandler.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;
		const address = await queryAi(getCaPrompt(text));
		if (!ctx.from?.id) return;
		const userLanguage = await getUserLanguage(ctx.from.id);

		if (address.toLowerCase() === "null") {
			// Reply with a warning emoji for invalid input
			await ctx.replyWithHTML(
				{
					english: "Please provide a valid value",
					french: "Veuillez fournir une valeur valide",
					spanish: "Por favor, proporcione un valor válido",
					arabic: "يرجى تقديم قيمة صالحة",
					chinese: "请提供有效值",
				}[userLanguage],
				Markup.inlineKeyboard([
					Markup.button.callback(
						{
							english: "Cancel",
							french: "Annuler",
							spanish: "Cancelar",
							arabic: "إلغاء",
							chinese: "取消",
						}[userLanguage],
						"cancel",
					),
				]),
			);
			return;
		} else {
			const tokenInfo = await processToken(address);
			if (tokenInfo === null) {
				// Token not found
				await ctx.reply(
					{
						english: "I couldn't find the token, unsupported chain, or wrong contract address.",
						french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
						spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
						arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
						chinese: "我找不到代币，不支持的链或错误的合约地址。",
					}[userLanguage],
				);
				return;
			} else {
				// Token found, store token information
				//	console.log(tokenInfo);
				ctx.scene.session.analysisStore.chain = tokenInfo.chain;
				ctx.scene.session.analysisStore.address = tokenInfo.address;
				ctx.scene.session.analysisStore.token = tokenInfo.token;
			}
			// After analyzing the address, prompt for the type of analysis
			await ctx.reply(
				{
					english: `📊 What type of analysis would you prefer for the token ${ctx.scene.session.analysisStore.token?.name}`,
					french: `📊 Quel type d'analyse préférez-vous pour le jeton ${ctx.scene.session.analysisStore.token?.name}`,
					spanish: `📊 ¿Qué tipo de análisis prefieres para el token ${ctx.scene.session.analysisStore.token?.name}?`,
					arabic: `📊 ما نوع التحليل الذي تفضله للرمز ${ctx.scene.session.analysisStore.token?.name}`,
					chinese: `📊 您希望对代币 ${ctx.scene.session.analysisStore.token?.name} 进行哪种类型的分析？`,
				}[userLanguage],
				Markup.inlineKeyboard([
					Markup.button.callback(
						{
							english: "AI % price change analysis",
							french: "Analyse de la variation des prix en % par l'IA",
							spanish: "Análisis de cambio de precio en % con IA",
							arabic: "تحليل تغير السعر بواسطة الذكاء الاصطناعي",
							chinese: "AI 百分比价格变化分析",
						}[userLanguage],
						`type_percentage`,
					),
					Markup.button.callback(
						{
							english: "AI Candle Stick data analysis",
							french: "Analyse des données en chandelier par l'IA",
							spanish: "Análisis de datos de velas con IA",
							arabic: "تحليل بيانات الشمعدان بواسطة الذكاء الاصطناعي",
							chinese: "AI 蜡烛图数据分析",
						}[userLanguage],
						`type_candlestick`,
					),
					Markup.button.callback(
						{
							english: "Cancel",
							french: "Annuler",
							spanish: "Cancelar",
							arabic: "إلغاء",
							chinese: "取消",
						}[userLanguage],
						"cancel",
					),
				]),
			);
		}
	}
	return ctx.wizard.next();
});

export const analysisWizard = new Scenes.WizardScene<WizardContext>(
	"analysis-wizard",
	async (ctx) => {
		const userid = ctx.from?.id;

		if (!userid) return;
		const userLanguage = await getUserLanguage(userid);
		await ctx.replyWithHTML(
			{
				english: "🔎 Please submit the contract address of the token you want to analyze",
				french: "🔎 Veuillez soumettre l'adresse du contrat du jeton que vous souhaitez analyser",
				spanish: "🔎 Por favor envía la dirección del contrato del token que deseas analizar",
				arabic: "🔎 يرجى إرسال عنوان عقد الرمز الذي تريد تحليله",
				chinese: "🔎 请提交您要分析的代币的合约地址",
			}[userLanguage],
			Markup.inlineKeyboard([
				Markup.button.callback(
					{
						english: "Cancel",
						french: "Annuler",
						spanish: "Cancelar",
						arabic: "إلغاء",
						chinese: "取消",
					}[userLanguage],
					"cancel",
				),
			]),
		);
		//console.log(ctx.scene.session.analysisStore.token);
		ctx.scene.session.analysisStore = JSON.parse(JSON.stringify(initialData));

		return ctx.wizard.next();
	},
	stepHandler,

	stepHandler,
	stepHandler,
);
