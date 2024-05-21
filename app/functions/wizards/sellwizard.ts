import { WizardContext } from "@app/functions/telegraf";

import { Composer, Context, Markup, Scenes } from "telegraf";

import { queryAi } from "../queryApi";
import { getCaPrompt, getamountprompt } from "../prompt";
import { fetchCoin } from "../fetchCoins";
import { addUserHolding, getUserWalletDetails, removeUserHolding, sendMessageToAllGroups } from "../databases";
import { getEtherBalance, getTokenBalance } from "../checkBalance";
import { addMillisecondsToDate, delay, getEthPrice, processToken } from "../helper";
import { sell, sellOnEth } from "../sellfunction";
import { TransactionReceipt } from "./buywizard";
import { time } from "console";
import { TokenData } from "../timePriceData";

const initialData = {
	sellAddress: null,
	amount: null,
	currency: null,
	token: null,
	time: undefined,
};
const stepHandler = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

export const sellWizard = new Scenes.WizardScene<WizardContext>(
	"sell-wizard",
	async (ctx) => {
		ctx.scene.session.sellStore = JSON.parse(JSON.stringify(initialData));
		//@ts-ignore

		ctx.scene.session.sellStore.sellAddress = ctx.scene.state.address;
		//@ts-ignore
		ctx.scene.session.sellStore.token = ctx.scene.state.token.token;
		//@ts-ignore
		ctx.scene.session.sellStore.time = ctx.scene.state.time;

		//@ts-ignore
		ctx.scene.session.sellStore.chain = ctx.scene.state.token.chain;

		if (!ctx.from?.id || !ctx.scene.session.sellStore.token || !ctx.scene.session.sellStore.sellAddress) {
			ctx.reply("An error occurred please try again");
			return ctx.scene.leave();
		}

		const wallet = getUserWalletDetails(ctx.from.id);

		const tokensBalance = await getTokenBalance(wallet?.walletAddress, ctx.scene.session.sellStore.token.address);
		const tokensBalanceInUsd = tokensBalance * ctx.scene.session.sellStore.token.price;

		const ethprice = await getEthPrice();
		const tokensBalanceInEth = tokensBalanceInUsd / ethprice;

		if (ctx.scene.session.sellStore.amount) {
			await ctx.replyWithHTML(
				`Are you sure you want to sell ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.sellStore.sellAddress}</b>
                \nAmount: <b>${ctx.scene.session.sellStore.amount} ${ctx.scene.session.sellStore.currency}</b>\nCurrent Price: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
				Markup.inlineKeyboard([
					Markup.button.callback("Yes I am sure", "sendsell"),
					Markup.button.callback("Cancel", "cancel"),
				]),
			);

			ctx.wizard.next();
			return ctx.wizard.next();
		} else {
			await ctx.replyWithHTML(
				`What amount(ETH, USD) of ${ctx.scene.session.sellStore.token?.name} do you want to sell, you have ${tokensBalance} ${ctx.scene.session.sellStore.token.name} worth $${tokensBalanceInUsd} and ${tokensBalanceInEth} ETH`,
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);

			return ctx.wizard.next();
		}
	},
	stepHandler2,

	stepHandler,
);

stepHandler2.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;

		const am = await queryAi(getamountprompt(text));
		if (am.toLowerCase() === "null") {
			await ctx.replyWithHTML(
				"Please provide a valid value.",
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);
			return;
		} else {
			ctx.scene.session.sellStore.amount = am;
		}

		const amount = ctx.scene.session.sellStore.amount;
		const sellAddress = ctx.scene.session.sellStore.sellAddress;
		ctx.scene.session.sellStore.currency = amount.toLowerCase().includes("$") ? "usd" : "eth";

		const regex = /-?\d+(\.\d+)?/;
		const matches = amount.match(regex);
		if (matches?.[0]) ctx.scene.session.sellStore.amount = matches?.[0];

		const token = await processToken(sellAddress);
		if (!token) {
			await ctx.reply("Could not find token, exiting.");
			return ctx.scene.leave();
		}
		ctx.scene.session.sellStore.token = token.token;

		await ctx.replyWithHTML(
			`Are you sure you want to sell ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.sellStore.sellAddress}</b>
                \nAmount: <b>${ctx.scene.session.sellStore.amount} ${ctx.scene.session.sellStore.currency}</b>\nCurrent Price: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
			Markup.inlineKeyboard([
				Markup.button.callback("Yes I am sure", "sendsell"),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);

		return ctx.wizard.next();
	}
});
stepHandler.action("sendsell", async (ctx) => {
	const { sellAddress, amount, token, time } = ctx.scene.session.sellStore;

	if (!sellAddress || !amount || !token) {
		ctx.reply("An error occurred please try again");
		return ctx.scene.leave();
	}

	const currency = ctx.scene.session.sellStore.currency;
	if (!currency) return ctx.scene.leave();
	const regex = /-?\d+(\.\d+)?/;

	const matches = amount.match(regex);
	if (matches?.[0]) {
		ctx.scene.session.sellStore.amount = matches?.[0];
	} else {
		ctx.reply("An error occurred please try again");
		return ctx.scene.leave();
	}

	if (time) {
		if (parseFloat(time) > 86400000) {
			ctx.reply("Error: Maximum interval is 24 hours");
			return ctx.scene.leave();
		}

		const date = addMillisecondsToDate(parseFloat(time));
		ctx.reply(`Sell has been scheduled for ${date.toTimeString()}`);
		//await delay(parseFloat(time));
		setTimeout(async () => {
			try {
				if (!ctx.scene.session.sellStore.amount) {
					ctx.reply("An error occurred please try again");
					return ctx.scene.leave();
				}
				await executeSell(ctx, currency, ctx.scene.session.sellStore.amount, token, sellAddress);
			} catch (error) {
				console.log(error);
				ctx.reply("An Erorr occurred, please try again later");
				return await ctx.scene.leave();
			}
		}, parseFloat(time));
	} else {
		ctx.reply(`Selling ${ctx.scene.session.sellStore.token?.name} ...`);

		try {
			await executeSell(ctx, currency, ctx.scene.session.sellStore.amount, token, sellAddress);
		} catch (error) {
			console.log(error);
			ctx.reply("An Erorr occurred, please try again later");
			return await ctx.scene.leave();
		}
	}

	return await ctx.scene.leave();
});

stepHandler.action("cancel", async (ctx) => {
	await ctx.reply("You've cancelled the operation");
	return await ctx.scene.leave();
});
stepHandler2.action("cancel", async (ctx) => {
	await ctx.reply("You've cancelled the operation");
	return await ctx.scene.leave();
});

const executeSell = async (
	ctx: WizardContext,
	currency: string,
	amount: string,
	token: TokenData,
	sellAddress: string,
) => {
	if (!ctx.from) return await ctx.replyWithHTML("<b>Transaction failed</b>");
	const wallet = getUserWalletDetails(ctx.from.id);
	const tokensBalance = await getTokenBalance(wallet?.walletAddress, token.address);
	const tokensBalanceInUsd = tokensBalance * token.price;
	//console.log(tokensBalance);

	const ethPrice = await getEthPrice();
	const tokensBalanceInEth = tokensBalanceInUsd / ethPrice;

	let amountintokens =
		currency.toLowerCase() === "eth"
			? (parseFloat(amount) * ethPrice) / token.price
			: parseFloat(amount) / token.price;

	if (amountintokens > tokensBalance) {
		ctx.replyWithHTML(
			`You have insufficient balance (<b>${tokensBalance} ${token.symbol}</b>) to make this transaction. Operation cancelled.`,
		);
		return ctx.scene.leave();
	}

	if (ctx.scene.session.sellStore.chain?.toLowerCase() === "ethereum") {
		try {
			await sellOnEth(wallet?.privateKey, token.address, amountintokens.toFixed(2).toString(), token.decimals);
		} catch (error: any) {
			await delay(5000);
			ctx.reply(`An Error occured please try again later\nError Message: ${error.message}`);

			return ctx.scene.leave();
		}
	}

	let receipt;
	//console.log(wallet?.privateKey, token.address, amountintokens, token.decimals);
	try {
		receipt = await sell(wallet?.privateKey, token.address, amountintokens.toFixed(2).toString(), token.decimals);
	} catch (error: any) {
		if (receipt) {
			ctx.reply(
				`An error occurred. Please try again later.\n Transaction hash:<a href= "https://basescan.org/tx/${receipt.transactionHash}">${receipt.transactionHash}</a>`,
			);
		} else {
			ctx.reply(`An Error occured please try again later\n
		Error Message: ${error.message}`);
		}

		return ctx.scene.leave();
	}

	await ctx.replyWithHTML(
		`You sold ${token?.name} \n<i>Amount: <b>${amount} ${currency}</b></i>\n<i>Contract Address: <b>${sellAddress}</b></i>\nTransaction hash:<a href= "https://basescan.org/tx/${receipt.transactionHash}">${receipt.transactionHash}</a>`,
	);

	const balance = await getTokenBalance(wallet?.walletAddress, sellAddress);
	if (balance <= 0 && receipt) removeUserHolding(ctx.from?.id, sellAddress);
	await sendMessageToAllGroups(
		`Succssful transaction made throught @NOVA bot.\n Transaction hash:<a href= "https://basescan.org/tx/${receipt.transactionHash}">${receipt.transactionHash}</a>`,
	);
	ctx.scene.leave();
	return receipt;
};
