import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";
import { fetchCoin } from "../fetchCoins";
import { TokenData, generateTimeAndPriceGraph } from "../timePriceData";
import { isEmpty, processToken } from "../helper";

const initialData = {
	address: "",
	chain: "",
	token: undefined,
	timeframe: "",
};

const stepHandler = new Composer<WizardContext>();

stepHandler.action(/tokenchart_(.+)/, async (ctx) => {
	const tokenName = ctx.match[1];
	const bsctoken = (await fetchCoin(ctx.scene.session.chartStore.address, "bsc")) as TokenData;
	const ethtoken = (await fetchCoin(ctx.scene.session.chartStore.address, "ethereum")) as TokenData;
	if (tokenName === ethtoken.name) {
		ctx.scene.session.chartStore.token = ethtoken;
		ctx.scene.session.chartStore.chain = "ethereum";
	} else {
		ctx.scene.session.chartStore.token = bsctoken;
		ctx.scene.session.chartStore.chain = "bsc";
	}
	await ctx.reply(
		"Choose the timeframe for the chart:",
		Markup.inlineKeyboard([
			Markup.button.callback("1m", "timeframechart_1m"),
			Markup.button.callback("5m", "timeframechart_5m"),
			Markup.button.callback("15m", "timeframechart_15m"),
			Markup.button.callback("30m", "timeframechart_30m"),
			Markup.button.callback("1H", "timeframechart_1H"),
			Markup.button.callback("4H", "timeframechart_4H"),
			Markup.button.callback("1D", "timeframechart_1D"),
		]),
	);

	return ctx.wizard.next();
});

stepHandler.action(/timeframechart_(.+)/, async (ctx) => {
	const timeframe = ctx.match[1];
	console.log(timeframe);
	ctx.scene.session.chartStore.timeframe = timeframe;

	const graphData = await generateTimeAndPriceGraph(
		ctx.scene.session.chartStore.address,
		timeframe,
		ctx.scene.session.chartStore.chain?.toLowerCase(),
	);
	if (!graphData) {
		ctx.reply("Please check your request and try again\n <i> Session exited...</i>");
		return ctx.scene.leave();
	} else {
		//Respond with graph data
		ctx.replyWithPhoto(graphData.url, {
			caption: `This is the price chart for ${ctx.scene.session.chartStore.token?.name}, ${graphData.timeAndPrice.timeOfReq}`,
		});
	}
	ctx.answerCbQuery();
	return ctx.scene.leave();
});

stepHandler.action("cancel", async (ctx) => {
	await ctx.reply("You've cancelled the operation\n <i> Session exited...</i>");
	return await ctx.scene.leave();
});

export const chartWizard = new Scenes.WizardScene<WizardContext>(
	"chart-wizard",
	async (ctx) => {
		await ctx.replyWithHTML(
			"<b>Please submit the contract address of the token you want to draw a chart for</b>",
			//Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
		);
		ctx.scene.session.chartStore = initialData;

		return ctx.wizard.next();
	},

	async (ctx) => {
		if (ctx.message && "text" in ctx.message) {
			const { text } = ctx.message;
			const address = await queryAi(getCaPrompt(text));
			//	console.log(getCaPrompt(text));
			//console.log(text);
			//return;

			if (address.toLowerCase() === "null") {
				await ctx.replyWithHTML(
					"<i>You need to provide a valid contract address.\nPlease submit the token address: </i>",
					Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
				);
				return;
			} else if (address.toLowerCase() === "error") {
				await ctx.replyWithHTML("<b>An error occured please try again\n <i> Session exited...</i> </b>");
				ctx.scene.leave();
			} else {
				const tokenInfo = await processToken(address);
				if (tokenInfo === null) {
					// Token not found
					await ctx.reply("I could not find the token. Please check the address and try again.");
					return;
				} else if (tokenInfo) {
					// Offer options to choose a specific token
					//ctx.scene.session.chartStore.address = tokenInfo.address;
					// return await ctx.replyWithHTML(
					// 	`<b>🤔 Choose the specific token</b>`,
					// 	Markup.inlineKeyboard([
					// 		Markup.button.callback(
					// 			`${tokenInfo.bsctoken.name}`,
					// 			`tokenchart_${tokenInfo.bsctoken.name}`,
					// 		),
					// 		Markup.button.callback(
					// 			`${tokenInfo.ethtoken.name}`,
					// 			`tokenxhart_${tokenInfo.ethtoken.name}`,
					// 		),
					// 	]),
					// );
				} else {
					// Token found, store token information
					//	console.log(tokenInfo);
					// ctx.scene.session.chartStore.chain = tokenInfo.chain;
					// ctx.scene.session.chartStore.address = tokenInfo.address;
					// ctx.scene.session.chartStore.token = tokenInfo.token;
				}

				await ctx.reply(
					"Choose the timeframe for the chart:",
					Markup.inlineKeyboard([
						Markup.button.callback("1m", "timeframechart_1m"),
						Markup.button.callback("5m", "timeframechart_5m"),
						Markup.button.callback("15m", "timeframechart_15m"),
						Markup.button.callback("30m", "timeframechart_30m"),
						Markup.button.callback("1H", "timeframechart_1H"),
						Markup.button.callback("4H", "timeframechart_4H"),
						Markup.button.callback("1D", "timeframechart_1D"),
					]),
				);
			}
		}
		return ctx.wizard.next();
	},
	stepHandler,
);
