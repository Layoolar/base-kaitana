import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";
import { fetchCoin } from "../fetchCoins";
import { TokenData } from "../timePriceData";
import { isEmpty, processToken } from "../helper";

const initialData = { address: "", token: undefined, chain: "" };

const stepHandler = new Composer<WizardContext>();

stepHandler.action(/tokendet_(.+)/, async (ctx) => {
	const tokenName = ctx.match[1];
	const bsctoken = (await fetchCoin(ctx.scene.session.chartStore.address, "bsc")) as TokenData;
	const ethtoken = (await fetchCoin(ctx.scene.session.chartStore.address, "ethereum")) as TokenData;
	if (tokenName === ethtoken.name) {
		ctx.scene.session.detailsStore.token = ethtoken;
		ctx.scene.session.detailsStore.chain = "ethereum";
	} else {
		ctx.scene.session.detailsStore.token = bsctoken;
		ctx.scene.session.detailsStore.chain = "bsc";
	}

	const coinAddress = ctx.scene.session.detailsStore.address;
	// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
	let selectedCoin = await fetchCoin(coinAddress, ctx.scene.session.detailsStore.chain);
	for (let key in selectedCoin) {
		if (selectedCoin[key] === null) {
			delete selectedCoin[key];
		}
	}
	//console.log(selectedCoin);
	const message = await queryAi(`send me this data "${JSON.stringify(selectedCoin)}" in a paragraph`);

	await ctx.reply(message);

	return ctx.scene.leave();
});

export const detailstWizard = new Scenes.WizardScene<WizardContext>(
	"details-wizard",
	async (ctx) => {
		await ctx.replyWithHTML("<b>Send me the the contract address of the token you want to get details for</b>");
		ctx.scene.session.detailsStore = initialData;
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
				await ctx.replyWithHTML("<b>An error occured please try agin </b>");
				ctx.scene.leave();
			} else {
				await ctx.reply(` Searching for the token with address ${address} ...`);
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
					// ctx.scene.session.detailsStore.chain = tokenInfo.chain;
					// ctx.scene.session.detailsStore.address = tokenInfo.address;
					// ctx.scene.session.detailsStore.token = tokenInfo.token;
				}

				const coinAddress = ctx.scene.session.detailsStore.address;
				// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
				let selectedCoin = await fetchCoin(coinAddress, ctx.scene.session.detailsStore.chain);
				for (let key in selectedCoin) {
					if (selectedCoin[key] === null) {
						delete selectedCoin[key];
					}
				}
				//console.log(selectedCoin);
				const message = await queryAi(`send me this data "${JSON.stringify(selectedCoin)}" in a paragraph`);

				await ctx.reply(message);
			}
			return ctx.scene.leave();
		}
	},
	stepHandler,
);
