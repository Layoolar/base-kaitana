import { WizardContext } from "@app/functions/telegraf";
import { error, log } from "console";
import { Composer, Markup, Scenes } from "telegraf";
import { createContext } from "vm";
import { check } from "yargs";
import { queryAi } from "../queryApi";
import { getCaPrompt, getamountprompt } from "../prompt";
import { fetchCoin } from "../fetchCoins";
import { addUserHolding, getUserWalletDetails, sendMessageToAllGroups } from "../databases";
import { buyOnBase, buyOnEth } from "../buyfunction";
import type { BigNumber } from "ethers";
import { getEtherBalance } from "../checkBalance";
import { addMillisecondsToDate, delay, getEthPrice, processToken } from "../helper";
import { TokenData } from "../timePriceData";

export type TransactionReceipt = {
	to: string | null; // Address this transaction is sent to
	from: string; // Address this transaction is sent from
	contractAddress: string | null; // Address of the newly created contract (if applicable)
	transactionIndex: number; // Index of this transaction in the block's list of transactions
	type: number; // Type of transaction (EIP-2718 type)
	gasUsed: BigNumber; // Amount of gas used by this transaction
	effectiveGasPrice: BigNumber; // Effective gas price charged for this transaction
	logsBloom: string; // Bloom filter containing addresses and topics of logs emitted by this transaction
	blockHash: string; // Hash of the block containing this transaction
	transactionHash: string; // Hash of this transaction
	logs: any[]; // Array of logs emitted by this transaction
	blockNumber: number; // Block number containing this transaction
	confirmations: number; // Number of blocks mined since this transaction
	cumulativeGasUsed: BigNumber; // Sum of gas used by all transactions up to this one in the block
	byzantium: boolean; // Indicates if the block is post-Byzantium Hard Fork
	status: number; // Status of the transaction (1 for success, 0 for failure)
};

const initialData = {
	buyAddress: null,
	amount: null,
	currency: null,
	token: null,
	time: undefined,
};

const stepHandler = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

stepHandler.action("sendbuy", async (ctx) => {
	const { buyAddress, amount, token, time } = ctx.scene.session.buyStore;
	// if (!buyAddress || !amount) {
	// 	return ctx.wizard.next();
	// }
	if (!buyAddress || !amount || !token) {
		ctx.reply("An error occurred please try again");
		return ctx.scene.leave();
	}
	//const amount = ctx.scene.session.buyStore.amount;

	ctx.scene.session.buyStore.currency = amount.toLowerCase().includes("$") ? "usd" : "eth";
	const currency = ctx.scene.session.buyStore.currency;
	//console.log(amount, currency);
	const regex = /-?\d+(\.\d+)?/;

	const matches = amount.match(regex);
	//console.log(matches);
	if (matches?.[0]) {
		ctx.scene.session.buyStore.amount = matches?.[0];
	} else {
		ctx.reply("An error occurred please try again");
		return ctx.scene.leave();
	}

	//console.log(amount);

	let receipt;
	if (time) {
		if (parseFloat(time) > 86400000) {
			ctx.reply("Error: Maximum interval is 24 hours");
			return ctx.scene.leave();
		}

		const date = addMillisecondsToDate(parseFloat(time));
		ctx.reply(`Buy has been scheduled for ${date.toTimeString()}`);
		//await delay(parseFloat(time));
		setTimeout(async () => {
			try {
				if (!ctx.scene.session.buyStore.amount) {
					ctx.reply("An error occurred please try again");
					return ctx.scene.leave();
				}
				//console.log(ctx.from, currency, ctx.scene.session.buyStore.amount, token, buyAddress);
				receipt = await executeBuy(ctx, currency, ctx.scene.session.buyStore.amount, token, buyAddress);
				//console.log(receipt);
			} catch (error) {
				console.log(error);
				ctx.reply("An Erorr occured, please try again later");
				return await ctx.scene.leave();
			}
		}, parseFloat(time));
	} else {
		ctx.reply(`Buying ${ctx.scene.session.buyStore.token?.name} ...`);
		try {
			if (!ctx.scene.session.buyStore.amount) {
				ctx.reply("An error occurred please try again");
				return ctx.scene.leave();
			}
			receipt = await executeBuy(ctx, currency, ctx.scene.session.buyStore.amount, token, buyAddress);
			//console.log(receipt);
		} catch (error) {
			console.log(error);
			ctx.reply("An Erorr occured, please try again later");
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
console;
export const buyWizard = new Scenes.WizardScene<WizardContext>(
	"buy-wizard",
	async (ctx) => {
		if (!ctx.from?.id) {
			ctx.reply("An error occurred please try again");
			return ctx.scene.leave();
		}
		ctx.scene.session.buyStore = JSON.parse(JSON.stringify(initialData));
		//@ts-ignore
		ctx.scene.session.buyStore.buyAddress = ctx.scene.state.address;
		//@ts-ignore
		ctx.scene.session.buyStore.token = ctx.scene.state.token.token;

		//@ts-ignore
		ctx.scene.session.buyStore.time = ctx.scene.state.time;

		//@ts-ignore
		ctx.scene.session.buyStore.amount = ctx.scene.state.amount;

		//@ts-ignore
		ctx.scene.session.buyStore.chain = ctx.scene.state.token.chain;

		const wallet = getUserWalletDetails(ctx.from.id);
		//const buyAddress = ctx.scene.session.buyStore.buyAddress;
		//console.log(buyAddress);
		//	const amount = ctx.scene.session.buyStore.amount;
		const userBalance = await getEtherBalance(wallet?.walletAddress);
		const ethprice = await getEthPrice();
		if (!userBalance) {
			ctx.reply("An error occurred please try again");
			return ctx.scene.leave();
		}
		const userBalanceInUsd = parseFloat(userBalance) * parseFloat(ethprice);

		if (ctx.scene.session.buyStore.amount) {
			await ctx.replyWithHTML(
				`Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>
			\nAmount: <b>${ctx.scene.session.buyStore.amount}</b>\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				Markup.inlineKeyboard([
					Markup.button.callback("Yes I am sure", "sendbuy"),
					Markup.button.callback("Cancel", "cancel"),
				]),
			);

			ctx.wizard.next();
			return ctx.wizard.next();
		} else {
			await ctx.replyWithHTML(
				`What amount(ETH, USD) of ${ctx.scene.session.buyStore.token?.name} do you want to buy, your balance is ${userBalance} ETH($${userBalanceInUsd}) `,
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);
			return ctx.wizard.next();
		}

		//await ctx.reply("What amount(ETH, USD) of token do you want to buy");
		//console.log("here");
		//ctx.wizard.next();
	},
	stepHandler2,

	stepHandler,
);

stepHandler2.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;
		//console.log(text);
		const am = await queryAi(getamountprompt(text));
		if (am.toLowerCase() === "null") {
			// Reply with a warning emoji for invalid input
			await ctx.replyWithHTML(
				"Please provide a valid value.",
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);

			return;
		} else {
			ctx.scene.session.buyStore.amount = am;
		}

		const buyAddress = ctx.scene.session.buyStore.buyAddress;
		const token = await processToken(buyAddress);
		if (!token) {
			await ctx.reply("Could not find token, exiting.");
			return ctx.scene.leave();
		}
		ctx.scene.session.buyStore.token = token.token;

		await ctx.replyWithHTML(
			`Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>
			\nAmount: <b>${ctx.scene.session.buyStore.amount}</b>\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
			Markup.inlineKeyboard([
				Markup.button.callback("Yes I am sure", "sendbuy"),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		return ctx.wizard.next();
	}
});

const executeBuy = async (
	ctx: WizardContext,
	currency: string,
	amount: string,
	token: TokenData,
	buyAddress: string,
) => {
	if (!ctx.from) {
		await ctx.replyWithHTML("<b>Transaction failed</b>");
		return await ctx.scene.leave();
	}
	const ethPrice = await getEthPrice();
	if (!ethPrice) {
		ctx.reply("An error occured please try again later here");
		return ctx.scene.leave();
	}

	let amountinEth = parseFloat(amount);

	if (currency === "usd") {
		amountinEth = parseFloat(amount) / ethPrice;
	}

	const wallet = getUserWalletDetails(ctx.from.id);

	const userBalance = await getEtherBalance(wallet?.walletAddress);
	if (!userBalance) {
		ctx.reply("An error occurred please try again here");
		return ctx.scene.leave();
	}
	if (parseFloat(userBalance) <= amountinEth) {
		ctx.reply("You have insuffient balance to make this transaction, please try again with a valid amount");
		return ctx.scene.leave();
	}
	//edit this

	// Use buy function here
	if (ctx.scene.session.buyStore.chain?.toLowerCase() === "ethereum") {
		try {
			//	console.log(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());

			await buyOnEth(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());
		} catch (error: any) {
			await delay(5000);
			ctx.reply(`An Error occured please try again later\nError Message: ${error.message}.`);
			return await ctx.scene.leave();
		}
	}

	//console.log(amountinEth);
	let receipt;
	try {
		//	console.log(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());

		receipt = await buyOnBase(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());
	} catch (error: any) {
		ctx.reply(`An Error occured please try again later\n
		Error Message: ${error.message}`);
		return await ctx.scene.leave();
	}

	await ctx.replyWithHTML(
		`You bought ${token.name} \n<i>Amount: <b>${amount} ${currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\ntx: https://basescan.org/tx/${receipt.transactionHash}`,
	);

	await sendMessageToAllGroups(
		`Succssful transaction made through @NOVA bot.\n Transaction hash:${receipt.transactionHash}`,
	);
	if (receipt) addUserHolding(ctx.from?.id, buyAddress);
	return receipt;
};
