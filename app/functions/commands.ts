/**
 * Telegraf Commands
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */

import { bot } from "@app/functions/actions";
import { Markup, MiddlewareFn, Context } from "telegraf";
import * as databases from "@app/functions/databases";
import config from "@configs/config";
import { launchPolling, launchWebhook } from "./launcher";
import { createSolWallet } from "./solhelper";
import fetchData, {
	fetchCoin,
	fetchCoinGeckoData,
	fetchDxToolsPairData,
	formatCoinsMessage,
	getDexPairDataWithAddress,
	sendAllChainData,
} from "./fetchCoins";
import { v4 as uuidv4 } from "uuid";
import { queryAi } from "./queryApi";
import { TokenData, generateTimeAndPriceGraph } from "./timePriceData";
import { calculatePoint } from "mermaid/dist/utils";
import { error, log } from "console";
import {
	getBuyPrompt,
	getCaPrompt,
	getSellPrompt,
	getTimePrompt,
	getamountprompt,
	getsellamountprompt,
} from "./prompt";
import {
	createWallet,
	extractTimeFromPrompt,
	getAllSolTokenBalances,
	getAllTokenBalances,
	getEthPrice,
	getSolPrice,
	isEmpty,
	processToken,
} from "./helper";
import { getEtherBalance } from "./checkBalance";
import { getSolBalance, getSolTokenAccounts } from "./checksolbalance";
// import { getEthPrice, getTokenInfo } from "./test";

// interface coins extends CoinDataType{

// }
export interface CoinDataType {
	token: string;
	rank: number;
	rankTrade24h: number;
	rankView: number;
	rankVolume24h: number;
	price: number;
	priceChange24hPercent: number;
	volume24h: number;
	volume24hChangePercent: number;
	view24h: number;
	view24hChangePercent: number | null;
	liquidity: number;
	network: string;
	tokenData: {
		name: string;
		symbol: string;
		decimals: number;
		icon: string;
		website: string;
	};
}

//let selectedCoin: any = null;
// interface BettingCoinData extends CoinDataType {
// 	position: number;
// }
export type BetData = {
	betId: string;
	name: string;
	token: string;
	symbol: string;
	priceAtStartOfBet: number;
	priceAtEndOfBet: undefined | number;
	network: string;
	direction: string;
	status: "open" | "closed";
	betVerdict: string;
};

bot.use((ctx, next) => {
	// If the message is from a group and the group ID is not registered, register it
	//console.log("here");
	if (ctx.chat)
		if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
			//console.log("here");
			// const res = databases.getCallHistory(ctx.chat.id);

			// if (res) return next();
			//	console.log("hi");
			databases.addGroup(ctx.chat.id);
			//console.log(ctx.chat.id);
			//console.log(`Group ${ctx.chat.id} has been automatically registered.`);
		}
	return next();
});

export async function getJoke() {
	try {
		// Call the queryAi function to retrieve a joke
		const joke = await queryAi("reply with a joke");
		return joke;
	} catch (error) {
		// Handle errors if any
		//console.log("Error fetching joke:", error);
		return null; // Return null or handle the error as needed
	}
}

export function getGreeting() {
	const now = new Date();
	const hours = now.getHours();

	if (hours >= 5 && hours < 12) {
		// Return "Good morning" with a sun emoji

		return "🌞 Good morning";
	} else if (hours >= 12 && hours < 18) {
		// Return "Good afternoon" with a smiley emoji
		return "😊 Good afternoon";
	} else {
		// Return "Good evening" with a crescent moon emoji
		return "🌜 Good evening";
	}
}

const isValidWallet = (address: string): boolean => {
	// ctx.reply;
	const ethAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;

	const isValidAddress = ethAddressRegex.test(address);

	if (isValidAddress) {
		return true;
	} else {
		return false;
	}
};

export const checkWallet: MiddlewareFn<Context> = async (ctx: Context, next: () => Promise<void>) => {
	if (!ctx.from) {
		return;
	}

	if (databases.isWalletNull(ctx.from.id)) {
		return next();
	}

	return await ctx.reply("You already have a wallet");
};
export const checkUserExistence: MiddlewareFn<Context> = async (ctx: Context, next: () => Promise<void>) => {
	if (!ctx.from) {
		return;
	}

	const user = databases.checkUserExists(ctx.from?.id);
	if (!user) {
		ctx.reply(`You are not yet registered send "/start" to the bot privately to get started.`);
		return;
	}
	await next();
};
const checkGroup: MiddlewareFn<Context> = (ctx, next) => {
	const chatType = ctx.chat?.type;

	if (chatType != "private") {
		ctx.reply("This command can only be sent as a direct message");
	} else {
		next();
	}
};
// const checkGroupIdMiddleware: MiddlewareFn<Context> = (ctx, next) => {
// 	// Replace 'YOUR_GROUP_ID' with the actual group ID
// 	//const allowedGroupId = -1002064195192;
// 	const allowedGroupId = -4005329091;
// 	if (!ctx.chat) {
// 		return;
// 	}
// 	const messageGroupId = ctx.chat?.id;

// 	if (messageGroupId !== allowedGroupId) {
// 		// If the message is not from the allowed group, do nothing
// 		ctx.reply("This command can only be used in the Nova  trade group");
// 		return;
// 	}

// 	// If the message is from the allowed group, continue with the next middleware
// 	return next();
// };
bot.catch((error: any) => {
	if (error.response && error.response.description.includes("bot was blocked by the user")) {
		const userId = error.on && error.on.message ? error.on.message.from.id : null;
		console.log(`Bot was blocked by user ${userId}.`);
	} else {
		console.error("Global error handler:", error);
	}
});
const commands = {
	"/start": "Send this command privately to the bot to register and get started",
	"/call <b>(CAN ONLY BE USED IN GROUPS)</b>":
		"This command is used to query a token and put it in focus for getting the details or trading.\nUsage Format: /call {contract address}",
	"/ask <b>(CAN ONLY BE USED IN GROUPS)</b>":
		"This command is used to ask questions about the called token and <b>trade</b> the called token, when you indicate buy or sell in your prompt.\nUsage Format: /ask {your question}",
	"/schedule":
		"This command is used to schedule trading.\nUsage format: /schedule i want to buy/sell {contract address} in one hour",
	"/import": "This command is used to import tokens into your wallet.\nUsage format: /import {contract address}",
	"/delete": "This command to delete tokens from your wallet.\nUsage format: /delete {contract address}",
	"/buy": "This command can be used to buy tokens.\nUsage format: /buy {your prompt to buy}",
	"/sell": "This command can be used to sell tokens.\nUsage format: /sell {your prompt to sell}",
	"/wallet": "This command can be used to  manange your wallet.\nUsage format: /wallet",
};

bot.help((ctx) => {
	const commandsList = Object.entries(commands)
		.map(([command, description]) => `${command}: ${description}`)
		.join("\n\n");

	ctx.replyWithHTML(`Here are some available commands:\n\n${commandsList}`);
});

bot.action("genwallet", async (ctx) => {
	if (!ctx.from) return;

	if (databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		ctx.reply("You have already generated a wallet use /wallet to view your wallet details");
		return;
	}
	const wallet = createWallet();
	const solWallet = createSolWallet();

	if (ctx.from) {
		databases.updateWallet(ctx.from?.id, wallet.walletAddress, wallet.privateKey, wallet.mnemonic);
		databases.updateSolWallet(ctx.from?.id, solWallet.publicKey, solWallet.privateKeyBase58);
	}

	await ctx
		.replyWithHTML(
			`Wallet generated sucessfully, your ETH wallet address is: <b><code>${wallet.walletAddress}</code></b>\nPrivate key: <code>${wallet.privateKey}</code>.\n\n
			And your SOL wallet address is: <b><code>${solWallet.publicKey}</code></b>\nPrivate key: <code>${solWallet.privateKeyBase58}</code>
			
			This message will be deleted in one minute, you can use /wallet to re-check your wallet details`,
		)
		.then((message) => {
			const messageId = message.message_id;

			setTimeout(async () => {
				try {
					await ctx.deleteMessage(messageId);
				} catch (error) {
					//console.error(`Failed to delete message ${messageId}:`);
				}
			}, 60000);
		})
		.catch((error) => {
			//console.log(error);
		});
});

bot.action("exportkey", async (ctx) => {
	if (!ctx.from) {
		return;
	}

	const walletDetails = databases.getUserWalletDetails(ctx.from.id);

	await ctx
		.replyWithHTML(
			`The private key for  your ETH wallet is <b><code>${walletDetails?.privateKey}</code></b>\n\n
			The private key for  your Sol wallet is <b><code>${walletDetails?.solPrivateKey}</code></b>\n\n This message will be deleted in one minute  `,
		)
		.then((message) => {
			const messageId = message.message_id;

			setTimeout(async () => {
				try {
					await ctx.deleteMessage(messageId);
				} catch (error) {
					console.error(`Failed to delete message ${messageId}:`);
				}
			}, 60000);
		})
		.catch((error) => {
			//	console.log(error);
		});
});

bot.action("walletaddress", async (ctx) => {
	if (!ctx.from) {
		return;
	}

	const walletDetails = databases.getUserWalletDetails(ctx.from.id);
	// console.log(walletDetails);
	await ctx.replyWithHTML(
		`Your ETH wallet address is <b><code>${walletDetails?.walletAddress}</code></b>\n\n
		 Your SOL wallet address is <b><code>${walletDetails?.solWalletAddress}</code></b>`,
	);
});

bot.action("checkbalance", checkUserExistence, async (ctx) => {
	await ctx.replyWithHTML(
		`${getGreeting()} ${
			ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name
		}, What balance do you want to check`,
		Markup.inlineKeyboard([
			[Markup.button.callback("Base balance", "basebalance")],
			[Markup.button.callback("ETH balance", "ethbalance")],
			[Markup.button.callback("Solana balance", "solbalance")],
		]),
	);
});

bot.action("basebalance", async (ctx) => {
	await ctx.reply("Fetching balances...");
	const user_id = ctx.from?.id;
	if (!user_id) {
		return;
	}
	const wallet = databases.getUserWalletDetails(user_id);

	if (!wallet) {
		return await ctx.reply("No wallet found.");
	}

	if (wallet?.baseholding.length === 0) {
		const balance = await getEtherBalance(wallet.walletAddress);
		const currentEthPrice = await getEthPrice();

		if (!balance || !currentEthPrice) {
			return ctx.reply("An error occured, please try again later");
		}
		const usdNetworth = parseFloat(balance.base) * currentEthPrice;
		return ctx.replyWithHTML(
			`You have no other tokens\nBalance: <b>${parseFloat(balance.base).toFixed(
				5,
			)}</b> ETH\nNet Worth: <b>$${usdNetworth.toFixed(5)}</b>`,
		);
	} else {
		if (!wallet.walletAddress) {
			return await ctx.reply("No wallet found.");
		}
		const balancesString = await getAllTokenBalances(wallet?.walletAddress, wallet?.baseholding, "base");

		if (balancesString) {
			await ctx.replyWithHTML(balancesString);
		}
	}
});
bot.action("solbalance", async (ctx) => {
	await ctx.reply("Fetching balances...");
	const user_id = ctx.from?.id;
	if (!user_id) {
		return;
	}
	const wallet = databases.getUserWalletDetails(user_id);

	if (!wallet) {
		return await ctx.reply("No wallet found.");
	}
	const tokens = await getSolTokenAccounts(wallet.solWalletAddress);
	if (tokens.length === 0) {
		const balance = await getSolBalance(wallet.solWalletAddress);
		//getSolBalance
		const currentSolPrice = await getSolPrice();

		if (!balance || !currentSolPrice) {
			return ctx.reply("An error occured, please try again later");
		}
		const usdNetworth = balance * currentSolPrice;
		return ctx.replyWithHTML(
			`You have no other tokens\nBalance: <b>${balance.toFixed(5)}</b> SOL\nNet Worth: <b>$${usdNetworth.toFixed(
				5,
			)}</b>`,
		);
	} else {
		if (!wallet.solWalletAddress) {
			return await ctx.reply("No wallet found.");
		}
		const tokenAddresses = await getSolTokenAccounts(wallet.solWalletAddress);
		const balancesString = await getAllSolTokenBalances(tokenAddresses, wallet.solWalletAddress);

		if (balancesString) {
			await ctx.replyWithHTML(balancesString);
		}
	}
});
bot.action("ethbalance", async (ctx) => {
	await ctx.reply("Fetching balances...");
	const user_id = ctx.from?.id;
	if (!user_id) {
		return;
	}
	const wallet = databases.getUserWalletDetails(user_id);
	if (!wallet) {
		return await ctx.reply("No wallet found.");
	}
	if (wallet?.ethholding.length === 0) {
		const balance = await getEtherBalance(wallet.walletAddress);

		const currentEthPrice = await getEthPrice();

		if (!balance || !currentEthPrice) {
			return await ctx.reply("An error occured, please try again later");
		}
		const usdNetworth = parseFloat(balance.eth) * currentEthPrice;
		return await ctx.replyWithHTML(
			`You have no other tokens\nBalance: <b>${parseFloat(balance.eth).toFixed(
				5,
			)}</b> ETH\nNet Worth: <b>$${usdNetworth.toFixed(5)}</b>`,
		);
	} else {
		if (!wallet.walletAddress) {
			return await ctx.reply("No wallet found.");
		}
		const balancesString = await getAllTokenBalances(wallet?.walletAddress, wallet?.ethholding, "ethereum");
		// console.log(balancesString);
		if (balancesString) {
			await ctx.replyWithHTML(balancesString);
		}
	}
});
bot.command("/wallet", checkUserExistence, checkGroup, async (ctx) => {
	const user_id = ctx.from?.id;
	// console.log(user_id);

	if (user_id) {
		if (databases.isWalletNull(user_id)) {
			// ctx.reply("generate wallet");
			await ctx.replyWithHTML(
				`${getGreeting()} ${
					ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name
				}, you don't have a wallet yet`,
				Markup.inlineKeyboard([[Markup.button.callback("Generate wallet", "genwallet")]]),
			);
		} else {
			// ctx.reply("view wallet ad, xport private key,send eth, send kai");
			await ctx.replyWithHTML(
				`${getGreeting()} ${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name}`,
				Markup.inlineKeyboard([
					[
						Markup.button.callback("Wallet address", "walletaddress"),
						Markup.button.callback("Export private key", "exportkey"),
					],

					[
						Markup.button.callback("Send ETH", "sendeth"),
						Markup.button.callback("Check balances", "checkbalance"),
					],
				]),
			);
		}
	}

	// console.log("hey");
});

export const neww = async () => {
	bot.command("/call", checkUserExistence, async (ctx) => {
		if (ctx.update.message.chat.type === "private") {
			if (ctx.update.message.from.is_bot) {
				return;
			}
			return await ctx.reply("This command cannot be used privately, only in Groups/Channels");
		}

		const commandArgs = ctx.message.text.split(" ").slice(1);
		const ca = commandArgs.join(" ");
		if (!ca) {
			return await ctx.reply("You need to send a contract address with your command");
		}
		// .ath.usd
		// market_cap.usd
		// fetchCoinGeckoData;
		// const contracAddress = "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE";
		// fetchCoinGeckoData(contractAddress)
		// 	.then((data) => ctx.reply(data.name))
		// 	.catch((error) => console.error("Error:", error));

		const res = await processToken(ca);
		const coin = res?.token;
		// console.log(coin);
		// console.log(await fetchCoin(ca, "ethereum"));
		// console.log(coin);
		if (coin) {
			databases.updateCurrentCalledAndPushToHistory(ctx.chat.id, ca);
			// console.log(contractAddress);
			// const coin = await fetchCoin(contractAddress, "ethereum");
			if (isEmpty(coin) || !coin.name) {
				return await ctx.reply("I couldn't find the token, please check the contract address and try again.");
			}
			//selectedCoin = coin;

			//	console.log(selectedCoin);

			const data = await getDexPairDataWithAddress(coin.address);

			// //console.log(data);
			if (!data) return ctx.reply("An error occurred please try again");

			// console.log(coin);

			await ctx.replyWithHTML(
				`<b>Getting Token Information...</b>\n\n<b>Token Name: </b><i>${coin.name}</i>\n<b>Token Address: </b> <i>${coin.address}</i>`,
			);
			const response = await queryAi(
				`This is a data response a token. Give a summary of the important information provided here ${JSON.stringify(
					{
						...coin,
						mcap: data[0].mcap,
					},
				)}. Don't make mention that you are summarizing a given data in your response. Don't say things like 'According to the data provided'. Send the summary back in few short paragraphs. Only return the summary and nothing else. Also wrap important values with HTML <b> bold tags,
				make the numbers easy for humans to read with commas and add a lot of emojis to your summary to make it aesthetically pleasing, for example add 💰 to price, 💎 to mcap,💦 to liquidity,📊 to volume,⛰to Ath, 📈 to % increase ,📉 to % decrease`,
			);

			return await ctx.replyWithHTML(response);
			// console.log(selectedCoin);
		} else {
			// console.log(contractAddress);
			return await ctx.reply("I couldn't find the token, please check the contract address and try again.");
		}
	});
	bot.command("/ask", checkUserExistence, async (ctx) => {
		if (ctx.update.message.chat.type === "private") {
			if (ctx.update.message.from.is_bot) {
				return;
			}
			return await ctx.reply("This command cannot be used privately, only in Groups/Channels");
		}
		const commandArgs = ctx.message.text.split(" ").slice(1);
		const prompt = commandArgs.join(" ");
		if (!prompt) {
			return await ctx.reply("You need to send a message with your command");
		}
		const selectedCa = databases.getCurrentCalled(ctx.chat.id);

		if (!selectedCa) {
			return await ctx.reply("Kindly use /call ${token_address} to start conversation about a token");
		}
		const processedToken = await processToken(selectedCa);
		//console.log(selectedCa);
		const selectedCoin = processedToken?.token;
		if (!selectedCoin) return await ctx.reply("Couldnt find token please try again");
		const res = await processToken(selectedCoin.address);

		if (!res) {
			return await ctx.reply("An error occured please try again");
		}

		const coin = res?.token;

		// const coin = await fetchCoin(selectedCoin.address, "ethereum");
		// console.log(res?.chain, selectedCoin.address);
		// const data = await getTokenInfo(selectedCoin.symbol);
		// const data = await fetchDxToolsPairData(selectedCoin.address, res.chain);
		// //console.log(data);
		// if (!data) return ctx.reply("An error occurred please try again");

		const userid = ctx.from.id;

		const response = await queryAi(getBuyPrompt(prompt));
		// console.log(response);

		if (response.toLowerCase() === "buy") {
			// send confirmation
			// console.log("buying");
			// Markup.inlineKeyboard
			if (databases.isWalletNull(userid)) {
				return await ctx.reply(
					`${
						ctx.from.username || ctx.from.first_name
					}, You do not have an attached wallet, send a direct message with /wallet to initialise it`,
				);
			}
			ctx.reply(
				`@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox`,
			);
			const amountRes = await queryAi(getamountprompt(prompt));
			//console.log(`proceedbuy_${selectedCoin?.address}_${amountRes}`);

			const message = await ctx.telegram.sendMessage(
				ctx.from?.id,
				`You are about to buy ${selectedCoin.name} with contract address ${selectedCoin.address}`,
				Markup.inlineKeyboard([
					Markup.button.callback("Proceed", `proceedbuy_${selectedCoin?.address} ${amountRes}`),
					Markup.button.callback("Cancel", "cancel"),
				]),
			);
			bot.action("cancel", async (ctx) => {
				await ctx.deleteMessage(message.message_id);
				return await ctx.reply("This operation has been cancelled");
			});
			return;

			// return ctx.scene.enter("buy-wizard", { address: selectedCoin.address, token: selectedCoin });
			//	const confirmation = await ctx.awaitReply("Please enter the amount you want to buy:");
		} else {
			const response = await queryAi(getSellPrompt(prompt));

			if (response.toLowerCase() === "sell") {
				if (databases.isWalletNull(userid)) {
					return await ctx.reply(
						`${
							ctx.from.username || ctx.from.first_name
						}, You have not initialised your wallet, send a dm with /wallet to initialise it.`,
					);
				}
				await ctx.reply(
					`@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox`,
				);

				const amountRes = await queryAi(getsellamountprompt(prompt));
				const message = await ctx.telegram.sendMessage(
					ctx.from?.id,
					`You are about to sell ${selectedCoin.name}`,
					Markup.inlineKeyboard([
						Markup.button.callback("Proceed", `proceedsell_${selectedCoin?.address} ${amountRes}`),
						Markup.button.callback("Cancel", "cancel"),
					]),
				);
				bot.action("cancel", async (ctx) => {
					await ctx.deleteMessage(message.message_id);
					return await ctx.reply("This operation has been cancelled");
				});
				return;

				// return ctx.scene.enter("sell-wizard", { address: selectedCoin.address, token: selectedCoin });
			}
			// const newData = {
			// 	...data,
			// 	mcap: data.fdv,
			// };
			const answer = await queryAi(
				`Answer this question "${prompt}" using information provided here ${JSON.stringify({
					...coin,
				})}. if you can't answer reply with a message indicating that you don't know`,
			);
			return await ctx.reply(answer);
		}
	});
};
// const tokenName = ctx.match[1];
/token_(.+)/;
/proceedsell_(.+)/;
/proceedbuy_([^_]+)_?(\w+)?/;
bot.action(/proceedbuy_(.+)/, async (ctx) => {
	const match = ctx.match;

	const amount = match[1].split(" ")[1] === "null" ? null : match[1].split(" ")[1];

	const ca = ctx.match[1].split(" ")[0];

	const token = await processToken(ca);

	const time = ctx.match[1].split(" ")[2];

	if (!token) {
		return await ctx.reply("An error occured please try again");
	}

	if (
		token.chain.toLowerCase() !== "ethereum" &&
		token.chain.toLowerCase() !== "base" &&
		token.chain.toLowerCase() !== "solana"
	) {
		return await ctx.reply(
			"We currrently only support trading on ethereum, base and solana for now. Please bear with us as we are working on supporting other tokens",
		);
	}

	//console.log(ca, token.chain, time, amount);
	return await ctx.scene.enter("buy-wizard", { address: ca, token: token, time: time, amount: amount });
});
bot.action(/proceedsell_(.+)/, async (ctx) => {
	const match = ctx.match;

	const amount = match[1].split(" ")[1] === "null" ? null : match[1].split(" ")[1];

	const ca = ctx.match[1].split(" ")[0];

	const token = await processToken(ca);

	const time = ctx.match[1].split(" ")[2];

	if (!token) {
		return await ctx.reply("An error occured please try again.");
	}
	if (
		token.chain.toLowerCase() !== "ethereum" &&
		token.chain.toLowerCase() !== "base" &&
		token.chain.toLowerCase() !== "solana"
	) {
		return await ctx.reply(
			"We currrently only support trading on ethereum, base and solana for now. Please bear with us as we are working on supporting other tokens",
		);
	}
	return await ctx.scene.enter("sell-wizard", { address: ca, token: token, time: time, amount: amount });
});
bot.command("/import", checkGroup, async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const ca = commandArgs.join(" ");
	if (!ca) {
		return await ctx.reply("You need to send a contract address with your command.");
	}

	const token = await processToken(ca);
	if (token) {
		// check if tokens with zero balance should be blocked
		await ctx.reply(`${token.token?.name} has been imported successfully.`);
		return databases.addUserHolding(ctx.from.id, ca, token.chain);
	} else {
		return await ctx.reply(`Couldn't find the token, Please check the contract address and try again.`);
	}
});
bot.command("/delete", checkGroup, async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const ca = commandArgs.join(" ");
	if (!ca) {
		return await ctx.reply("You need to send a contract address with your command.");
	}

	const token = await processToken(ca);
	if (token) {
		// check if tokens with zero balance should be blocked
		databases.removeUserHolding(ctx.from.id, ca, token.chain);
		await ctx.reply(`${token.token?.name} has been deleted successfully.`);
		return;
	} else {
		return await ctx.reply(`Couldn't find the token, Please check the prompt and contract address.`);
	}
});

const coinActions = () => {};
bot.command("/buy", async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");

	const ca = await queryAi(getCaPrompt(prompt));
	const amount = await queryAi(getamountprompt(prompt));
	if (ca.toLowerCase() === "null") {
		return await ctx.reply("You need to send a contract address with your command.");
	}

	const token = await processToken(ca);
	if (!token) {
		return await ctx.reply(`Couldn't find the token, Please check the prompt and contract address.`);
	}

	if (!databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		return await ctx.reply("You have not generated a wallet yet, kindly send /wallet command privately");
	}

	await ctx.reply(
		`@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox`,
	);

	const message = await ctx.telegram.sendMessage(
		ctx.from?.id,
		`You are about to buy ${token.token.name}`,
		Markup.inlineKeyboard([
			Markup.button.callback(`Proceed`, `proceedbuy_${token?.address} ${amount}`),
			Markup.button.callback("Cancel", "cancel"),
		]),
	);
	bot.action("cancel", async (ctx) => {
		await ctx.deleteMessage(message.message_id);
		return await ctx.reply("This operation has been cancelled.");
	});
});
bot.command("/sell", async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");

	const ca = await queryAi(getCaPrompt(prompt));
	const amount = await queryAi(getsellamountprompt(prompt));
	if (ca.toLowerCase() === "null") {
		return await ctx.reply("You need to send a contract address with your command.");
	}
	const token = await processToken(ca);
	if (!token) {
		return await ctx.reply(`Couldn't find the token, Please check the prompt and contract address.`);
	}
	if (!databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		return await ctx.reply("You have not generated a wallet yet, kindly send /wallet command privately");
	}
	await ctx.reply(
		`@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox`,
	);
	const message = await ctx.telegram.sendMessage(
		ctx.from?.id,
		`You are about to sell ${token.token.name}`,
		Markup.inlineKeyboard([
			Markup.button.callback("Proceed", `proceedsell_${token?.address} ${amount}`),
			Markup.button.callback("Cancel", "cancel"),
		]),
	);
	bot.action("cancel", async (ctx) => {
		await ctx.deleteMessage(message.message_id);
		return await ctx.reply("This operation has been cancelled.");
	});
});
bot.command("/schedule", async (ctx) => {
	const currentUnixTime = Math.floor(Date.now() / 1000);
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");
	// console.log(prompt);
	if (!prompt) {
		return await ctx.reply("You need to send a prompt with your command.");
	}

	let time: string | null;
	time = await queryAi(getTimePrompt(prompt));
	// let time2
	if (time.toLowerCase() === "null") {
		time = extractTimeFromPrompt(prompt);

		if (!time) {
			return await ctx.reply("There is no time interval present in your message.");
		}
	}

	const ca = await queryAi(getCaPrompt(prompt));
	if (ca.toLowerCase() === "null") {
		return ctx.reply("There is no contract address present in your prompt.");
	}

	const responseBuy = await queryAi(getBuyPrompt(prompt));
	const responseSell = await queryAi(getSellPrompt(prompt));
	const token = await processToken(ca);
	if (!token) {
		return await ctx.reply(`Couldn't find the token, Please check the prompt and contract address.`);
	}
	if (!databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		return await ctx.reply("You have not generated a wallet yet, kindly send /wallet command privately");
	}

	if (responseBuy.toLowerCase() === "buy" && responseSell.toLowerCase() !== "sell") {
		// console.log(ca);
		const amount = await queryAi(getamountprompt(prompt));
		await ctx.reply(
			`@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox`,
		);
		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			`You are about to schedule a buy for ${token?.token?.name}`,
			Markup.inlineKeyboard([
				Markup.button.callback("Proceed", `proceedbuy_${token?.address} ${amount} ${time}`),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		bot.action("cancel", async (ctx) => {
			await ctx.deleteMessage(message.message_id);
			return await ctx.reply("This operation has been cancelled.");
		});
		return;
	} else if (responseSell.toLowerCase() === "sell" && responseBuy.toLowerCase() !== "buy") {
		const amount = await queryAi(getsellamountprompt(prompt));

		await ctx.reply(
			`@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox`,
		);
		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			`You are about to schedule a sell for ${token?.token?.name}`,
			Markup.inlineKeyboard([
				Markup.button.callback("Proceed", `proceedsell_${token?.address} ${amount} ${time}`),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		bot.action("cancel", (ctx) => {
			ctx.deleteMessage(message.message_id);
			return ctx.reply("This operation has been cancelled.");
		});
		return;
	} else {
		return ctx.reply("We couldn't parse your request, please try again.");
	}
});
/**
 * command: /quit
 * =====================
 * If user exit from bot
 *
 */

const quit = async (): Promise<void> => {
	bot.command("quit", (ctx) => {
		ctx.telegram.leaveChat(ctx.message.chat.id);
		ctx.leaveChat();
	});
};

/**
 * command: /start
 * =====================
 * Send welcome message
 *
 */

// bot.on("message", (ctx) => {
// 	console.log(ctx.chat.id);
// });
const buttons = Markup.inlineKeyboard([
	[Markup.button.callback("💼 Wallet", "wallet")],
	[Markup.button.callback("🤖 Sell Tokens", "sell")],
]);

const menu = async (): Promise<void> => {
	// bot.command("menu", checkUserExistence, async (ctx) => {
	// 	chatId = ctx.message.chat.id;
	// 	ctx.telegram.sendMessage(
	// 		ctx.message.chat.id,
	// 		`${getGreeting()} ${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name}`,
	// 		{
	// 			reply_markup: buttons.reply_markup,
	// 			parse_mode: "HTML",
	// 		},
	// 	);
	// });
};

const start = async (): Promise<void> => {
	bot.start((ctx) => {
		const groupId = ctx.chat.id;
		if (ctx.update.message.chat.type === "private") {
			if (ctx.update.message.from.is_bot) {
				return;
			}
			databases.writeUser({
				...ctx.update.message.from,
				walletAddress: null,
				bets: [],
				privateKey: null,
				mnemonic: null,
				ethholding: [],
				baseholding: [],
				solWalletAddress: null,
				solPrivateKey: null,
				solMnemonic: null,
			});

			//	chatId = ctx.message.chat.id;
			ctx.reply(`Welcome you have been sucessfully registered use /help to get started`);
		} else {
			ctx.reply(
				`@${
					ctx.message.from.username || ctx.message.from.last_name
				}, send a private message to the bot to get started`,
			);
		}
	});
};

// const submitWallet = async (): Promise<void> => {
// 	bot.command("submitwallet", checkGroup, async (ctx) => {
// 		if (!databases.checkUserExists(ctx.from.id)) {
// 			return ctx.reply("you are not yet registered, send /start command to get started");
// 		}
// 		const inputArray = ctx.message.text.split(" ");
// 		const commandText = inputArray.slice(1).join(" ");

// 		if (commandText) {
// 			if (isValidWallet(commandText)) {
// 				// save wallet to db
// 				if (databases.updateWallet(ctx.from.id, commandText)) {
// 					return ctx.reply("wallet submitted successfully");
// 				}
// 			} else {
// 				return ctx.reply("invalid wallet address");
// 			}
// 		} else {
// 			return ctx.reply(" Add your wallet address to the command");
// 		}
// 	});
// };

/**
 * Run bot
 * =====================
 * Send welcome message
 *
 */
const launch = async (): Promise<void> => {
	const mode = config.mode;
	if (mode === "webhook") {
		launchWebhook();
	} else {
		launchPolling();
	}
};

export { launch, quit, start, coinActions, menu };
export default launch;
