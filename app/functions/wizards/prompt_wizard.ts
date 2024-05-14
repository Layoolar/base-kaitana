import { WizardContext } from "@app/functions/telegraf";
import { Composer, Context, Markup, Scenes } from "telegraf";
import { queryAi } from "../queryApi";
import { getBuyPrompt, getCaPrompt, getamountprompt } from "../prompt";
import { fetchCoin, sendAllChainData } from "../fetchCoins";
import { TokenData } from "../timePriceData";
import { json } from "express";
import { conversation } from "../queryApi";
import { isEmpty, processToken } from "../helper";

const initialData = {
	prompt: "",
	address: null,
	token: undefined,
	chain: "",
	chatHistory: [],
};
// promptStore: {
// 		prompt: string;
//         address:string;

// 	};
const stepHandler = new Composer<WizardContext>();

stepHandler.action("cancel", async (ctx) => {
	await ctx.reply("You've cancelled the operation");

	return await ctx.scene.leave();
});

const fn2 = async (ctx: WizardContext) => {
	if (ctx.message && "text" in ctx.message) {
		console.log(ctx.scene.session.promptStore.address);
		const { text } = ctx.message;
		//console.log(text);

		const address = await queryAi(getCaPrompt(text));

		//	const intentionPrompt = `Check if this ${text} expresses intention to buy a token, if it does that reply this message with "buy", you just reply with one word "buy"`;
		//console.log(address);
		if (text.toLowerCase() !== "exit") {
			//const intention = await queryAi(intentionPrompt);
			//console.log(ctx.scene.session.promptStore.chatHistory);
			const intention = await queryAi(getBuyPrompt(text));
			//console.log(intention);
			if (intention.toLowerCase() === "buy") {
				const buyResponse = await queryAi(getCaPrompt(text));
				const amountResponse = await queryAi(getamountprompt(text));

				console.log(intention);
				let buyAddress: string | null = buyResponse;
				//let amount:string|null = null

				//console.log(buyAddress, amount);

				if (buyResponse.toLowerCase() === "null") {
					if (ctx.scene.session.promptStore.address) {
						buyAddress = ctx.scene.session.promptStore.address;
					} else {
						buyAddress = null;
					}
				}
				// } else {
				// 	buyAddress = buyResponse;
				// }
				const initial = {
					buyAddress: buyAddress,
					amount: amountResponse.toLowerCase() === "null" ? null : amountResponse,
					currency: null,
					token: null,
				};
				ctx.scene.leave();
				return ctx.scene.enter("buy-wizard", initial);
			}

			if (address.toLowerCase() !== "null") {
				//console.log("here");

				const tokenInfo = await processToken(address);
				if (tokenInfo === null) {
					// Token not found
					await ctx.reply("I could not find the token. Please check the address and try again.");
					return;
				} else if (tokenInfo) {
					// Offer options to choose a specific token
					ctx.scene.session.promptStore.address = tokenInfo.address;
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
					// ctx.scene.session.promptStore.chain = tokenInfo.chain;
					// ctx.scene.session.promptStore.address = tokenInfo.address;
					// ctx.scene.session.promptStore.token = tokenInfo.token;
				}

				const coinAddress = ctx.scene.session.promptStore.address;
				// Here you can proceed with handling the selected coin, such as fetching its value or any other relevant information
				let selectedCoin = await fetchCoin(coinAddress, ctx.scene.session.promptStore.chain);
				for (let key in selectedCoin) {
					if (selectedCoin[key] === null) {
						delete selectedCoin[key];
					}
				}
				console.log(selectedCoin);
				ctx.scene.session.promptStore.token = selectedCoin;
				//console.log(selectedCoin);
				const prompt2 = `This is a complete data for a token including market cap, current price and price changes"${JSON.stringify(
					selectedCoin,
				)}". Use that information to answer this question. "${text}" If you have insufficient information to answer the question, reply information unavialable"`;

				const prompt3 = `This is data for a token including market cap/liquidity, current price and price changes"${JSON.stringify(
					selectedCoin,
				)}". Be very tactical and thorough. As long as the address given to you is a valid cryptocurenncy address. You must use the data
				 in the data provided to answer it. It is very sure the answers are there. So you need to be tactical. Make it a conversational response. If there is no existing data  above. Reply tell them the information is unavailable`;

				const prompt4 = `This is data for a token "${JSON.stringify(
					selectedCoin,
				)}". use the information provided to answer any question in this "${text}"`;

				const detailsCompletionMessage = await conversation(prompt4, ctx.scene.session.promptStore.chatHistory);

				if (detailsCompletionMessage) {
					await ctx.replyWithHTML(
						detailsCompletionMessage,
						Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
					);

					//console.log(completionMessage);

					ctx.scene.session.promptStore.chatHistory.push(["user", prompt4]);
					ctx.scene.session.promptStore.chatHistory.push(["assistant", detailsCompletionMessage]);

					return;
				}
			}

			const completionMessage = await conversation(text, ctx.scene.session.promptStore.chatHistory);
			// if (completionMessage?.toLowerCase() === "null") {
			// }

			if (completionMessage) {
				await ctx.replyWithHTML(
					completionMessage,
					Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
				);

				//console.log(completionMessage);

				ctx.scene.session.promptStore.chatHistory.push(["user", text]);
				ctx.scene.session.promptStore.chatHistory.push(["assistant", completionMessage]);

				return;
			}
		}
		const exitMessage = await conversation("exit", ctx.scene.session.promptStore.chatHistory);
		if (exitMessage) await ctx.replyWithHTML(exitMessage);
		await ctx.scene.leave();
	}
};

export const promptWizard = new Scenes.WizardScene<WizardContext>(
	"prompt-wizard",
	async (ctx) => {
		await ctx.replyWithHTML("<b>🤖 Ask me anything!. You can type exit at any time to end the conversation.</b>");

		//const chatHistory: string[][] = [];
		//console.log(initialData)
		//	console.log("here");
		ctx.scene.session.promptStore = initialData;
		ctx.scene.session.promptStore.chatHistory = [];
		ctx.scene.session.promptStore.address = null;

		// console.log(ctx.scene.session.promptStore.chatHistory);
		// console.log(ctx.scene.session.promptStore.address);
		return ctx.wizard.next();
	},
	fn2,
	stepHandler,
);
