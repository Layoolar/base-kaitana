import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { fetchCoin } from "../fetchCoins";
import { processToken } from "../helper";
import { formatNumber } from "../commands";
import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";

const stepHandler = new Composer<WizardContext>();

export const infoWizard = new Scenes.WizardScene<WizardContext>(
	"info-wizard",
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		await ctx.replyWithHTML("<b>What contract address do you want to get info for</b>");

		return ctx.wizard.next();
	},
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		if (ctx.message && "text" in ctx.message) {
			const { text: address } = ctx.message;

			const resp = await queryAi(getCaPrompt(address));
			if (address.length && resp !== "null") {
				const res = await processToken(address);
				const coin = res?.token;

				if (!coin) {
					await ctx.reply("I couldn't find the token, unsupported chain, or wrong contract address.");
					return ctx.scene.leave();
				}
				await ctx.replyWithHTML(
					`<b>Getting Token Information...</b>\n\n<b>Token Name: </b><b><i>${coin.name}</i></b>\n<b>Token Address: </b> <code><i>${coin.address}</i></code>`,
				);

				const response2 = `🟢<a href="https://birdeye.so/token/${coin.address}?chain=${
					res.chain
				}"><b>${coin.name.toUpperCase()}</b></a> [${formatNumber(coin.mc)}] $${coin.symbol.toUpperCase()}
🌐${res.chain.charAt(0).toUpperCase() + res.chain.slice(1)}
💰 USD: <code>$${coin.price.toFixed(7)}</code>
💎FDV: <code>${formatNumber(coin.mc)}</code>
💦 Liq: <code>${coin.liquidity}</code>
📊 Vol: <code>Vol</code>
📈 1hr: ${coin.priceChange1hPercent ? `${coin.priceChange1hPercent.toFixed(2)}%` : "N/A"}
📉 24h: ${coin.priceChange8hPercent ? `${coin.priceChange8hPercent.toFixed(2)}%` : "N/A"}

<code>${coin.address}</code>
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

				return ctx.wizard.next();
			} else {
				await ctx.replyWithHTML(
					"Invalid contract address\n Exiting session...",
					Markup.inlineKeyboard([Markup.button.callback("Exit Session", "cancel")]),
				);
				return ctx.scene.leave();
			}
		}
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
		await ctx.reply("I couldn't find the token, unsupported chain, or wrong contract address.");
		return ctx.scene.leave();
	}

	if (token.chain.toLowerCase() !== "ethereum" && token.chain.toLowerCase() !== "base") {
		await ctx.reply(
			"We currently only support trading on Ethereum for now. Please bear with us as we are working on supporting other tokens.",
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
		return await ctx.reply("An error occurred, please try again");
	}
	if (token.chain.toLowerCase() !== "ethereum" && token.chain.toLowerCase() !== "base") {
		await ctx.reply(
			"We currently only support trading on Ethereum for now. Please bear with us as we are working on supporting other tokens.",
		);
		return ctx.scene.leave();
	}
	ctx.scene.leave();
	return await ctx.scene.enter("sell-wizard", { address: ca, token: token, time: time, amount: amount });
});

const cancelFn = async (ctx: WizardContext) => {
	const exitMessage = await queryAi("send me a goodbye message");
	if (exitMessage) {
		await ctx.replyWithHTML(exitMessage);
	}
	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelFn);
