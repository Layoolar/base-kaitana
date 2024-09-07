import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { fetchCoin } from "../fetchCoins";
import { processToken } from "../helper";
import { formatNumber } from "../commands";
import { conversation, queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";

const initialData = {
	res: null,
	chatHistory: [],
	address: null,
};

const stepHandler = new Composer<WizardContext>();

export const txinfoWizard = new Scenes.WizardScene<WizardContext>(
	"tx_info-wizard",
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}

		ctx.scene.session.txinfoStore = JSON.parse(JSON.stringify(initialData));
		// @ts-ignore
		ctx.scene.session.txinfoStore.address = ctx.scene.state.address;
		const address = ctx.scene.session.txinfoStore.address;

		const res = await processToken(address);
		const coin = res?.token;

		if (!coin) {
			await ctx.reply(
				"I couldn't find the token, unsupported chain, or wrong contract address. Please ensure you use a clear and high-quality screenshot of the contract address. Low-quality images may not be processed correctly. If the issue persists, please try again as it could be a random malfunction.\n\n <i> Session exited...</i>",
			);

			return ctx.scene.leave();
		}

		ctx.scene.session.txinfoStore.res = res;
		await ctx.replyWithHTML(
			`<b>Getting Token Information...</b>\n\n<b>Token Name: </b><b><i>${coin.name}</i></b>\n<b>Token Address: </b> <code><i>${coin.address}</i></code>`,
		);

		const response2 = `🟢<a href="https://birdeye.so/token/${coin?.address}?chain=${
			res?.chain
		}"><b>${coin.name?.toUpperCase()}</b></a> [${formatNumber(coin.mc)}] $${coin.symbol?.toUpperCase()}
🌐${res.chain.charAt(0).toUpperCase() + res.chain.slice(1)}
💰 USD: ${coin.price ? `<code>$${coin?.price?.toFixed(7)}</code>` : "N/A"}
💎FDV: <code>${formatNumber(coin?.mc)}</code>
💦 Liq: <code>${formatNumber(coin?.liquidity)}</code>
📈 1hr: ${coin?.priceChange1hPercent ? `${coin.priceChange1hPercent?.toFixed(2)}%` : "N/A"}
📉 24h: ${coin?.priceChange8hPercent ? `${coin.priceChange8hPercent?.toFixed(2)}%` : "N/A"}

<code>${coin?.address}</code>
`;

		await ctx.replyWithHTML(
			response2,
			Markup.inlineKeyboard([
				Markup.button.callback("Buy", `proceedbuy_${coin.address}`),
				Markup.button.callback(
					"Sell",

					`proceedsell_${coin.address}`,
				),
			]),
		);
		await ctx.replyWithHTML(
			`Type any other questions about ${coin.name}?\n<i>you can type exit or use the Exit session button to leave the session.</i>`,
			Markup.inlineKeyboard([
				Markup.button.callback(
					"Exit Session",

					"cancel",
				),
			]),
		);
		return ctx.wizard.next();
	},

	stepHandler,
	stepHandler,
);

stepHandler.action(/proceedbuy_(.+)/, async (ctx) => {
	const userid = ctx.from?.id;

	if (!userid) {
		return;
	}
	//const userLanguage = await getUserLanguage(userid);
	const match = ctx.match;

	const amount = match[1].split(" ")[1] === "null" ? null : match[1].split(" ")[1];

	const ca = ctx.match[1].split(" ")[0];

	const token = await processToken(ca);

	const time = ctx.match[1].split(" ")[2];

	if (!token) {
		await ctx.reply(
			"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
		);
		return ctx.scene.leave();
	}

	if (token.chain.toLowerCase() !== "ethereum" && token.chain.toLowerCase() !== "base") {
		await ctx.reply(
			"We currently only support trading on Ethereum for now. Please bear with us as we are working on supporting other tokens.\n <i> Session exited...</i>",
		);
		return ctx.scene.leave();
	}

	ctx.scene.leave();
	return await ctx.scene.enter("buy-wizard", { address: ca, token: token, time: time, amount: amount });
});
stepHandler.action(/proceedsell_(.+)/, async (ctx) => {
	const userid = ctx.from?.id;

	if (!userid) {
		return;
	}
	//const userLanguage = await getUserLanguage(userid);
	const match = ctx.match;

	const amount = match[1].split(" ")[1] === "null" ? null : match[1].split(" ")[1];

	const ca = ctx.match[1].split(" ")[0];

	const token = await processToken(ca);

	const time = ctx.match[1].split(" ")[2];

	if (!token) {
		await ctx.reply("An error occurred, please try again\n <i> Session exited...</i>");
		return ctx.scene.leave();
	}
	if (token.chain.toLowerCase() !== "ethereum" && token.chain.toLowerCase() !== "base") {
		await ctx.reply(
			"We currently only support trading on Ethereum for now. Please bear with us as we are working on supporting other tokens.\n <i> Session exited...</i>",
		);
		return ctx.scene.leave();
	}
	ctx.scene.leave();
	return await ctx.scene.enter("sell-wizard", { address: ca, token: token, time: time, amount: amount });
});

const cancelFn = async (ctx: WizardContext) => {
	await ctx.replyWithHTML(`<b><i>Session Exited...</i></b>\nThank you for using ParrotAI. See you soon.`);
	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelFn);
stepHandler.on("text", async (ctx) => {
	if (!ctx.from) {
		return await ctx.scene.leave();
	}
	if (ctx.message && "text" in ctx.message) {
		const { text: prompt } = ctx.message;

		if (prompt.toLowerCase() !== "exit") {
			const res = ctx.scene.session.txinfoStore.res;

			const coin = res?.token;

			if (!coin) {
				await ctx.reply(
					"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
				);
				return ctx.scene.leave();
			}

			const prompt4 = `This is data for a token "${JSON.stringify({
				...res?.token,
			})}". use the information provided to answer any question in this "${prompt}. Reply "This information is unavailable" to any question you can't answer"`;

			const detailsCompletionMessage = await conversation(prompt4, ctx.scene.session.txinfoStore.chatHistory);

			if (detailsCompletionMessage) {
				await ctx.replyWithHTML(
					detailsCompletionMessage,
					Markup.inlineKeyboard([
						Markup.button.callback(
							"Exit Session",

							"cancel",
						),
						Markup.button.callback("Buy", `proceedbuy_${coin.address}`),
						Markup.button.callback(
							"Sell",

							`proceedsell_${coin.address}`,
						),
					]),
				);

				// console.log(completionMessage);

				ctx.scene.session.txinfoStore.chatHistory.push(["user", prompt4]);
				ctx.scene.session.txinfoStore.chatHistory.push(["assistant", detailsCompletionMessage]);

				return;
			} else {
				await ctx.replyWithHTML(`<b><i>Session Exited...</i></b>\nThank you for using ParrotAI. See you soon.`);
				return ctx.scene.leave();
			}
		}
		await ctx.replyWithHTML(`<b><i>Session Exited...</i></b>\nThank you for using ParrotAI. See you soon.`);

		await ctx.scene.leave();
	}
});
