import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";
import { fetchCoin } from "../fetchCoins";
import { TokenData, generateTimeAndPriceGraph } from "../timePriceData";
import { toUnicode } from "punycode";
import { fetchOHLCVData } from "../fetchCandlestickData";
import { isEmpty, processToken } from "../helper";

const initialData = {
	address: "",
	chain: "",
	token: undefined,
	type: "",
};

const stepHandler = new Composer<WizardContext>();

stepHandler.action(/token_(.+)/, async (ctx) => {
	const tokenName = ctx.match[1];
	const bsctoken = (await fetchCoin(ctx.scene.session.analysisStore.address, "bsc")) as TokenData;
	const ethtoken = (await fetchCoin(ctx.scene.session.analysisStore.address, "ethereum")) as TokenData;
	if (tokenName === ethtoken.name) {
		ctx.scene.session.analysisStore.token = ethtoken;
		ctx.scene.session.analysisStore.chain = "ethereum";
	} else {
		ctx.scene.session.analysisStore.token = bsctoken;
		ctx.scene.session.analysisStore.chain = "bsc";
	}
	await ctx.reply(
		`What type of analysis would you prefer for the token ${ctx.scene.session.analysisStore.token?.name}`,
		Markup.inlineKeyboard([
			Markup.button.callback(`AI percentage price change analysis`, `type_percentage`),
			Markup.button.callback(` AI Candle Stick data analysis`, `type_candlestick`),
		]),
	);

	return ctx.wizard.next();
});

stepHandler.action(/timeframe_(.+)/, async (ctx) => {
	//console.log("in here");
	await ctx.reply(
		`Performing analysis for ${ctx.scene.session.analysisStore.token?.name} with address ${ctx.scene.session.analysisStore.address} ...`,
	);
	const startTime = Math.floor((Date.now() - 12 * 24 * 60 * 60 * 1000) / 1000);

	const endTime = Math.floor(Date.now() / 1000);
	const timeframe = ctx.match[1];
	const data = await fetchOHLCVData(
		ctx.scene.session.analysisStore.address,
		"usd",
		timeframe,
		startTime,
		endTime,
		ctx.scene.session.analysisStore.chain,
	);
	const analysisPromptCandle = `Below are the candlestick data of a token's prices in diffrent intervals... Identify market trends or indicators and use that data to predict maybe the token will go up or down...


You must choose out of up or down and give reason, make it conversational

 this is the data ${data};`;
	if (!data) {
		ctx.reply("An Error occured please try again");
	}
	ctx.reply(await queryAi(analysisPromptCandle));
	ctx.answerCbQuery();
	return ctx.scene.leave();
});

stepHandler.action(/type_(.+)/, async (ctx) => {
	const type = ctx.match[1];
	console.log(type);
	if (type === "candlestick") {
		await ctx.reply(
			"Choose the timeframe for the analysis:",
			Markup.inlineKeyboard([
				Markup.button.callback("1m", "timeframe_1m"),
				Markup.button.callback("5m", "timeframe_5m"),
				Markup.button.callback("15m", "timeframe_15m"),
				Markup.button.callback("30m", "timeframe_30m"),
				Markup.button.callback("1H", "timeframe_1H"),
				Markup.button.callback("4H", "timeframe_4H"),
				Markup.button.callback("1D", "timeframe_1D"),
			]),
		);
		ctx.answerCbQuery();
		return ctx.wizard.next();
	} else {
		const analysisPrompt = `Below are the time changes of a token's prices in diffrent intervals... Identify market trends or indicators and use that data to predict maybe the token will go up or down...


You must choose out of up or down and give reason, make it conversational

 this is the data ;`;
		const coinData = await fetchCoin(
			ctx.scene.session.analysisStore.address,
			ctx.scene.session.analysisStore.chain?.toLowerCase(),
		);
		if (!coinData) {
			ctx.reply("Token could not be found, please check the details and try again");
			return ctx.scene.leave();
		}
		await ctx.reply(
			`Performing analysis for ${coinData.name} with address ${ctx.scene.session.analysisStore.address} ...`,
		);
		const aiAnalysis = await queryAi(`${analysisPrompt} ${JSON.stringify(coinData)}`);
		await ctx.reply(aiAnalysis);
		ctx.answerCbQuery();
		return ctx.scene.leave();
	}
});

stepHandler.action("cancel", async (ctx) => {
	await ctx.reply("You've cancelled the operation");
	return await ctx.scene.leave();
});

export const analysisWizard = new Scenes.WizardScene<WizardContext>(
	"analysis-wizard",
	async (ctx) => {
		await ctx.replyWithHTML("<b>🔎 Please submit the contract address of the token you want to analyze</b>");
		//console.log(ctx.scene.session.analysisStore.token);
		ctx.scene.session.analysisStore = initialData;

		return ctx.wizard.next();
	},
	//stepHandler,

	async (ctx) => {
		if (ctx.message && "text" in ctx.message) {
			const { text } = ctx.message;
			const address = await queryAi(getCaPrompt(text));

			if (address.toLowerCase() === "null") {
				// Reply with a warning emoji for invalid input
				await ctx.replyWithHTML(
					"<i>⚠️ You need to provide a valid contract address.\nPlease submit the token address: </i>",
					Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
				);
				return;
			} else if (address.toLowerCase() === "error") {
				// Reply with an error emoji for unexpected errors
				await ctx.replyWithHTML("<b>❌ An error occurred. Please try again.</b>");
				ctx.scene.leave();
			} else {
				const tokenInfo = await processToken(address);
				if (tokenInfo === null) {
					// Token not found
					await ctx.reply("I could not find the token. Please check the address and try again.");
					return;
				} else if (tokenInfo) {
					// Offer options to choose a specific token
					//ctx.scene.session.analysisStore.address = tokenInfo.address;
					// return await ctx.replyWithHTML(
					// 	`<b>🤔 Choose the specific token</b>`,
					// 	Markup.inlineKeyboard([
					// 		Markup.button.callback(`${tokenInfo.bsctoken.name}`, `token_${tokenInfo.bsctoken.name}`),
					// 		Markup.button.callback(`${tokenInfo.ethtoken.name}`, `token_${tokenInfo.ethtoken.name}`),
					// 	]),
					// );
				} else {
					// Token found, store token information
					//	console.log(tokenInfo);
					// ctx.scene.session.analysisStore.chain = tokenInfo.chain;
					// ctx.scene.session.analysisStore.address = tokenInfo.address;
					// ctx.scene.session.analysisStore.token = tokenInfo.token;
				}
				// After analyzing the address, prompt for the type of analysis
				await ctx.reply(
					`📊 What type of analysis would you prefer for the token ${ctx.scene.session.analysisStore.token?.name}`,
					Markup.inlineKeyboard([
						Markup.button.callback(`AI % price change analysis`, `type_percentage`),
						Markup.button.callback(`AI Candle Stick data analysis`, `type_candlestick`),
					]),
				);
			}
		}
		return ctx.wizard.next();
	},
	stepHandler,
	stepHandler,
);
