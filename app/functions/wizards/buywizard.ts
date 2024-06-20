import { WizardContext } from "@app/functions/telegraf";

import { Composer, Markup, Scenes } from "telegraf";

import { queryAi } from "../queryApi";
import { getamountprompt } from "../prompt";

import { addUserHolding, getUserWalletDetails, sendMessageToAllGroups } from "../databases";
import { buyOnBase, buyOnEth } from "../buyfunction";
import type { BigNumber } from "ethers";
import { getEtherBalance } from "../checkBalance";
import { addMillisecondsToDate, delay, getEthPrice, getSolPrice, processToken } from "../helper";
import { TokenData } from "../timePriceData";
import { getSolBalance } from "../checksolbalance";
import { buyTokensWithSolana } from "../solana";

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
	userBalance: null,
	time: undefined,
};

const stepHandler = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

stepHandler.action("sendbuy", async (ctx) => {
	const { buyAddress, token, time, userBalance } = ctx.scene.session.buyStore;
	let tokenAmount: string;
	let amount = ctx.scene.session.buyStore.amount;
	if (!buyAddress || !amount || !token || !userBalance) {
		ctx.reply("An error occurred please try again");
		return ctx.scene.leave();
	}
	const regex = /-?\d+(\.\d+)?/;

	const matches = amount.match(regex);
	// console.log(matches);
	if (matches?.[0]) {
		amount = matches?.[0];
	} else {
		ctx.reply("An error occurred please try again");
		return ctx.scene.leave();
	}

	// ctx.scene.session.buyStore.currency = amount.toLowerCase().includes("$") ? "usd" : "eth";
	// const currency = ctx.scene.session.buyStore.currency;
	// console.log(amount, currency);

	if (
		ctx.scene.session.buyStore.chain?.toLowerCase() === "ethereum" ||
		ctx.scene.session.buyStore.chain?.toLowerCase() === "base"
	) {
		const ethprice = (await getEthPrice()) as number;
		console.log(ethprice);
		if (!ethprice) {
			ctx.reply("Couldn't get token price");
			return ctx.scene.leave();
		}
		tokenAmount = (parseFloat(amount) / ethprice).toString();
		console.log(tokenAmount);
	} else if (ctx.scene.session.buyStore.chain?.toLowerCase() === "solana") {
		//tokenAmount = ""
		const solprice = (await getSolPrice()) as number;
		//console.log(solprice);
		if (!solprice) {
			ctx.reply("Couldn't get token price");
			return ctx.scene.leave();
		}
		tokenAmount = (parseFloat(amount) / solprice).toString();
	} else {
		tokenAmount = "";
	}

	// console.log(amount);

	let receipt;
	if (time) {
		if (parseFloat(time) > 86400000) {
			ctx.reply("Error: Maximum interval is 24 hours");
			return ctx.scene.leave();
		}

		const date = addMillisecondsToDate(parseFloat(time));
		ctx.reply(`Buy has been scheduled for ${date.toTimeString()}`);
		// await delay(parseFloat(time));
		setTimeout(async () => {
			try {
				if (!ctx.scene.session.buyStore.amount) {
					ctx.reply("An error occurred please try again");
					return ctx.scene.leave();
				}
				// console.log(ctx.from, currency, ctx.scene.session.buyStore.amount, token, buyAddress);
				receipt = await executeBuy(ctx, parseFloat(tokenAmount), token, buyAddress, userBalance);
				// console.log(receipt);
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
			// 			const executeBuy = async (
			// 	ctx: WizardContext,
			// 	amount: number,
			// 	token: TokenData,
			// 	buyAddress: string,
			// 	userBalance:number
			// )
			console.log(tokenAmount);
			receipt = await executeBuy(ctx, parseFloat(tokenAmount), token, buyAddress, userBalance);
			// console.log(receipt);
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

		const wallet = getUserWalletDetails(ctx.from.id);
		if (!wallet) {
			await ctx.reply("You have not generated a wallet yet, kindly send /wallet command privately");
			return ctx.scene.leave();
		}
		ctx.scene.session.buyStore = JSON.parse(JSON.stringify(initialData));
		//{ address: ca, token: token, time: time, amount: amount }
		// @ts-ignore
		ctx.scene.session.buyStore.buyAddress = ctx.scene.state.address;
		// @ts-ignore
		ctx.scene.session.buyStore.token = ctx.scene.state.token.token;

		// @ts-ignore
		ctx.scene.session.buyStore.time = ctx.scene.state.time;

		// @ts-ignore
		ctx.scene.session.buyStore.amount = ctx.scene.state.amount;

		// @ts-ignore
		ctx.scene.session.buyStore.chain = ctx.scene.state.token.chain;

		// const buyAddress = ctx.scene.session.buyStore.buyAddress;
		// console.log(buyAddress);
		//	const amount = ctx.scene.session.buyStore.amount;
		const chain = ctx.scene.session.buyStore.chain;
		//let userBalance;

		if (chain === "base") {
			ctx.scene.session.buyStore.currency = "ETH";
			const res = await getEtherBalance(wallet?.walletAddress);
			if (!res) {
				await ctx.reply("Couldn't get balance, please try again");
				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = parseFloat(res.base);
			//userBalance = res?.base;
		} else if (chain === "solana") {
			ctx.scene.session.buyStore.currency = "SOL";
			const solbalance = await getSolBalance(wallet?.solWalletAddress);
			if (!solbalance) {
				await ctx.reply("Couldn't get balance, please try again");

				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = solbalance;
		} else {
			ctx.scene.session.buyStore.currency = "ETH";
			const res = await getEtherBalance(wallet?.walletAddress);
			if (!res) {
				await ctx.reply("Couldn't get balance, please try again");
				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = parseFloat(res.eth);
		}

		//const ethprice = await getEthPrice();
		if (!ctx.scene.session.buyStore.userBalance) {
			ctx.reply("An error occurred please try again");
			return ctx.scene.leave();
		}
		//const userBalanceInUsd = userBalance * parseFloat(ethprice);

		if (ctx.scene.session.buyStore.amount) {
			await ctx.replyWithHTML(
				`Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>
			\nAmount: <b>${ctx.scene.session.buyStore.amount} </b>\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				Markup.inlineKeyboard([
					Markup.button.callback("Yes I am sure", "sendbuy"),
					Markup.button.callback("Cancel", "cancel"),
				]),
			);

			ctx.wizard.next();
			return ctx.wizard.next();
		} else {
			await ctx.replyWithHTML(
				`What amount(USD) of ${ctx.scene.session.buyStore.token?.name} do you want to buy`,
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);
			return ctx.wizard.next();
		}

		// await ctx.reply("What amount(ETH, USD) of token do you want to buy");
		// console.log("here");
		// ctx.wizard.next();
	},
	stepHandler2,

	stepHandler,
);

stepHandler2.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;
		// console.log(text);
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
			await ctx.reply("I couldn't find the token, unsupported chain or wrong contract address. Please try again");
			return ctx.scene.leave();
		}
		ctx.scene.session.buyStore.token = token.token;

		await ctx.replyWithHTML(
			`Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>
			\nAmount: <b>${ctx.scene.session.buyStore.amount} </b>\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
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
	amount: number,
	token: TokenData,
	buyAddress: string,
	userBalance: number,
) => {
	if (!ctx.from) {
		await ctx.replyWithHTML("<b>Transaction failed</b>");
		return await ctx.scene.leave();
	}

	const wallet = getUserWalletDetails(ctx.from.id);

	//let userBalance=ctx.scene.session.buyStore.userBalance;

	if (userBalance <= amount) {
		ctx.reply("You have insuffient balance to make this transaction, please try again with a valid amount");
		return ctx.scene.leave();
	}
	// edit this
	let hash;
	// Use buy function here
	if (ctx.scene.session.buyStore.chain?.toLowerCase() === "ethereum") {
		try {
			//	console.log(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());

			hash = await buyOnEth(wallet?.privateKey, buyAddress, amount.toFixed(15).toString());
			if (!hash) throw new Error("Transaction failed/expired");
			await ctx.replyWithHTML(
				`You bought ${token.name} \n<i>Amount: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\nTransaction hash:<a href= "https://etherscan.io/tx/${hash}">${hash}</a>`,
			);

			// await sendMessageToAllGroups(
			// 	`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
			// );
			if (hash) {
				addUserHolding(ctx.from?.id, buyAddress, "ethereum");
			}
			return hash;
		} catch (error: any) {
			ctx.reply(`An Error occured please try again later\nError Message: ${error.message}.`);
			return await ctx.scene.leave();
		}
	}

	// console.log(amountinEth);

	if (ctx.scene.session.buyStore.chain?.toLowerCase() === "solana") {
		try {
			throw new Error("Due to the congestion on the sol ecosystem, Spl tokn trades ar teemporarily unavailable");
			hash = await buyTokensWithSolana(wallet?.privateKey, buyAddress, amount.toFixed(15));
			if (!hash) throw new Error("Transaction failed/expired due to network congestion");

			await ctx.replyWithHTML(
				`You bought ${token.name} \n<i>Amount: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\nTransaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			);

			// await sendMessageToAllGroups(
			// 	`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			// );

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
	try {
		//	console.log(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());

		hash = await buyOnBase(wallet?.privateKey, buyAddress, amount.toFixed(15).toString());
		if (!hash) throw new Error("Transaction failed/expired");
	} catch (error: any) {
		ctx.reply(`An Error occured please try again later\n
		Error Message: ${error.message}`);

		return await ctx.scene.leave();
	}

	await ctx.replyWithHTML(
		`You bought ${token.name} \n<i>Amount: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\nTransaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
	);

	// await sendMessageToAllGroups(
	// 	`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
	// );
	if (hash) {
		addUserHolding(ctx.from?.id, buyAddress, "base");
	}
	return hash;
};
