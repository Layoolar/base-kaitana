import { WizardContext } from "@app/functions/telegraf";

import { Composer, Context, Markup, Scenes } from "telegraf";

import { queryAi } from "../queryApi";
import { getCaPrompt, getamountprompt, getsellamountprompt } from "../prompt";
import { fetchCoin } from "../fetchCoins";
import { addUserHolding, getUserWalletDetails, removeUserHolding, sendMessageToAllGroups } from "../databases";
import { getEtherBalance, getTokenBalance } from "../checkBalance";
import { addMillisecondsToDate, delay, getEthPrice, processToken } from "../helper";
import { sell, sellOnEth } from "../sellfunction";
import { TransactionReceipt } from "./buywizard";
import { time } from "console";
import { TokenData } from "../timePriceData";
import { getParticularTokenBalance } from "../checksolbalance";
import { sellTokensWithSolana } from "../solana";

const initialData = {
	sellAddress: null,
	amount: null,
	currency: null,
	token: null,
	time: undefined,
	userBalance:null
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
		// @ts-ignore
		ctx.scene.session.buyStore.amount = ctx.scene.state.amount;
		//@ts-ignore
		ctx.scene.session.sellStore.chain = ctx.scene.state.token.chain;

		if (!ctx.from?.id || !ctx.scene.session.sellStore.token || !ctx.scene.session.sellStore.sellAddress) {
			ctx.reply("An error occurred please try again");
			return ctx.scene.leave();
		}

		if (ctx.scene.session.sellStore.amount) {
			await ctx.replyWithHTML(
				`Are you sure you want to sell ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.sellStore.sellAddress}</b>
                \nAmount: <b>${ctx.scene.session.sellStore.amount} %</b>\nCurrent Price: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
				Markup.inlineKeyboard([
					Markup.button.callback("Yes I am sure", "sendsell"),
					Markup.button.callback("Cancel", "cancel"),
				]),
			);

			ctx.wizard.next();
			return ctx.wizard.next();
		} else {
			await ctx.replyWithHTML(
				`What percentage of ${ctx.scene.session.sellStore.token?.name} do you want to sell `,
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

		const am = await queryAi(getsellamountprompt(text));
		if (am.toLowerCase() === "null") {
			await ctx.replyWithHTML(
				"Please provide a valid value.",
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);
			return;
		} else {
			ctx.scene.session.sellStore.amount = am;
		}

		//const amount = ctx.scene.session.sellStore.amount;
		const sellAddress = ctx.scene.session.sellStore.sellAddress;

		const token = await processToken(sellAddress);
		if (!token) {
			await ctx.reply("Could not find token, exiting.");
			return ctx.scene.leave();
		}
		ctx.scene.session.sellStore.token = token.token;

		await ctx.replyWithHTML(
			`Are you sure you want to sell ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.sellStore.sellAddress}</b>
                \nAmount: <b>${ctx.scene.session.sellStore.amount} %</b>\nCurrent Price: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
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
				await executeSell(ctx, amount, token, sellAddress);
			} catch (error) {
				console.log(error);
				ctx.reply("An Erorr occurred, please try again later");
				return await ctx.scene.leave();
			}
		}, parseFloat(time));
	} else {
		ctx.reply(`Selling ${ctx.scene.session.sellStore.token?.name} ...`);

		try {
			await executeSell(ctx, amount, token, sellAddress);
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

	amount: string,
	token: TokenData,
	sellAddress: string,
) => {
	if (!ctx.from) return await ctx.replyWithHTML("<b>Transaction failed</b>");
	const wallet = getUserWalletDetails(ctx.from.id);
	const tokenData = await processToken(sellAddress);
	if (!tokenData) {
		await ctx.reply("An error occured please try again");
		return ctx.scene.leave();
	}

	if (tokenData.chain === "base") {
		ctx.scene.session.sellStore.currency = "ETH";
		//const res = await getEtherBalance(wallet?.walletAddress);
		const tokensBalance = await getTokenBalance(wallet?.walletAddress, token.address, "base");
		if (!tokensBalance) {
			await ctx.reply("Couldn't get balance, please try again");
			return ctx.scene.leave();
		}

		//continue hereee/ trying to get the amount
		ctx.scene.session.sellStore.userBalance = tokensBalance;
		//userBalance = res?.base;
	} else if (tokenData.chain === "solana") {
		ctx.scene.session.sellStore.currency = "SOL";
		const solbalance = await getParticularTokenBalance(sellAddress, wallet?.walletAddress);
		if (!solbalance || solbalance.length === 0) {
			await ctx.reply("Couldn't get balance, please try again");

			return ctx.scene.leave();
		}
		ctx.scene.session.sellStore.userBalance = solbalance[0].tokenBalance;
	} else if (tokenData.chain === "ethereum") {
		ctx.scene.session.sellStore.currency = "ETH";
		const tokensBalance = await getTokenBalance(wallet?.walletAddress, token.address, "ethereum");
		if (!tokensBalance) {
			await ctx.reply("Couldn't get balance, please try again");
			return ctx.scene.leave();
		}
		ctx.scene.session.sellStore.userBalance = tokensBalance;
	} else {
		await ctx.reply("only trading on sol,base and eth yet");
		return ctx.scene.leave();
	}

	if (!ctx.scene.session.sellStore.userBalance) {
		await ctx.reply("Couldn't get balance, please try again");
		return ctx.scene.leave();
	}

const amountintokens = (parseFloat(amount) / 100) * ctx.scene.session.sellStore.userBalance;

	if (amountintokens > ctx.scene.session.sellStore.userBalance) {
		ctx.replyWithHTML(
			`You have insufficient balance (<b>${ctx.scene.session.sellStore.userBalance} ${token.symbol}</b>) to make this transaction. Operation cancelled.`,
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

	let hash;
	if (ctx.scene.session.sellStore.chain?.toLowerCase() === "solana") {
		try {
		
			hash = await sellTokensWithSolana(wallet?.privateKey, sellAddress, amountintokens.toFixed(15),token.decimals);

			await ctx.replyWithHTML(
				`You sold ${token.name} \n<i>Amount: <b>${amountintokens} ${token.symbol}</b></i>\n<i>Contract Address: <b>${sellAddress}</b></i>\nTransaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			);

			await sendMessageToAllGroups(
				`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			);

			// if (hash) {
			// 	addUserHolding(ctx.from?.id, buyAddress, "solana");
			// }
			return hash;
		} catch (error: any) {
			//await delay(5000);
			ctx.reply(`An Error occured please try again later\nError Message: ${error.message}.`);
			return await ctx.scene.leave();
		}
	}
	//console.log(wallet?.privateKey, token.address, amountintokens, token.decimals);

	try {
		hash = await sell(wallet?.privateKey, token.address, amountintokens.toFixed(2).toString(), token.decimals);
	} catch (error: any) {
		if (hash) {
			ctx.reply(
				`An error occurred. Please try again later.\n Transaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
			);
		} else {
			ctx.reply(`An Error occured please try again later\n
		Error Message: ${error.message}`);
		}

		return ctx.scene.leave();
	}

	await ctx.replyWithHTML(
		`You sold ${token?.name} \n<i>Amount: <b>${amount} % of your tokens</b></i>\n<i>Contract Address: <b>${sellAddress}</b></i>\nTransaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
	);

	const balance = await getTokenBalance(wallet?.walletAddress, sellAddress);
	if (balance <= 0 && hash) removeUserHolding(ctx.from?.id, sellAddress, "base");
	await sendMessageToAllGroups(
		`Succssful transaction made throught @NOVA bot.\n Transaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
	);
	ctx.scene.leave();
	return hash;
};
