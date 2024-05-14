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
import fetchData, {
	fetchCoin,
	fetchCoinGeckoData,
	fetchDxToolsPairData,
	formatCoinsMessage,
	sendAllChainData,
} from "./fetchCoins";
import { v4 as uuidv4 } from "uuid";
import { queryAi } from "./queryApi";
import { TokenData, generateTimeAndPriceGraph } from "./timePriceData";
import { calculatePoint } from "mermaid/dist/utils";
import { log } from "console";
import { getBuyPrompt, getCaPrompt, getSellPrompt, getTimePrompt } from "./prompt";
import { createWallet, extractTimeFromPrompt, getAllTokenBalances, getEthPrice, isEmpty, processToken } from "./helper";
import { getEtherBalance } from "./checkBalance";
//import { getEthPrice, getTokenInfo } from "./test";

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

let selectedCoin: any = null;
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

let chatId: number;

const analysisPrompt1 = `Below are the values of a token prices in the Las 30 minutes... Identify market trends or indicators and use that data to predict maybe the token will go up or down...


You must choose out of up or down and give reason

 this is the data const dataObject = {
  price: [73.48, 28.59, 11.71, 95.41, 42.57],
  time: [0, 5, 10, 15, 20, 25],
};`;
const analysisPrompt = `Below are the time changes of a token's prices in diffrent intervals... Identify market trends or indicators and use that data to predict maybe the token will go up or down...


You must choose out of up or down and give reason, make it conversational

 this is the data ;`;

export async function getJoke() {
	try {
		// Call the queryAi function to retrieve a joke
		const joke = await queryAi("reply with a joke");
		return joke;
	} catch (error) {
		// Handle errors if any
		console.log("Error fetching joke:", error);
		return null; // Return null or handle the error as needed
	}
}

export function getGreeting() {
	const now = new Date();
	const hours = now.getHours();

	if (hours >= 5 && hours < 12) {
		//Return "Good morning" with a sun emoji

		return "🌞 Good morning";
	} else if (hours >= 12 && hours < 18) {
		// Return "Good afternoon" with a smiley emoji
		return "😊 Good afternoon";
	} else {
		// Return "Good evening" with a crescent moon emoji
		return "🌜 Good evening";
	}
}

// async function sendHourlyMessage() {
// 	const ethdata = await fetchData("ethereum", null);
// 	const soldata = await fetchData("solana", null);
// 	const bnbdata = await fetchData("bnb", null);

// 	bot.telegram.sendMessage(chatId, formatCoinsMessage(ethdata, null));
// 	bot.telegram.sendMessage(chatId, formatCoinsMessage(soldata, null));
// 	bot.telegram.sendMessage(chatId, formatCoinsMessage(bnbdata, null));
// }

// setInterval(sendHourlyMessage, 3000);
// setInterval(() => console.log("hi"), 3000);

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
	if (!ctx.from) return;

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

const commands = {
	"/start": "Send this command privately to the bot to register and get started",
	"/call":
		"This command is used to query a token and put it in focus for getting the details or trading.\nUsage Format: /call your question",
	"/ask": "This command is used to ask questions about the called token and/or trade the called token",
	"/schedule":
		"This command is used to schedule trading.\nUsage format: /schedule i want to buy/sell {contract address} in one hour",
	"/import": "This command is used to import tokens into your wallet.\nUsage format: /import {contract address}",
	"/delete": "This command to delete tokens from your wallet.\nUsage format: /delete {contract address}",
	"/buy": "This command can be used to buy tokens.\nUsage format: /buy {contract address}",
	"/sell": "This command can be used to sell tokens.\nUsage format: /sell {contract address}",
};

bot.help((ctx) => {
	const commandsList = Object.entries(commands)
		.map(([command, description]) => `${command}: ${description}`)
		.join("\n\n");

	ctx.reply(`Here are some available commands:\n\n${commandsList}`);
});

bot.action("genwallet", async (ctx) => {
	const wallet = createWallet();
	if (ctx.from) databases.updateWallet(ctx.from?.id, wallet.walletAddress, wallet.privateKey, wallet.mnemonic);

	ctx.replyWithHTML(`Wallet generated sucessfully, your wallet address is: <b>${wallet.walletAddress}</b>`);
});

bot.action("exportkey", async (ctx) => {
	if (!ctx.from) return;

	const walletDetails = databases.getUserWalletDetails(ctx.from.id);

	ctx.replyWithHTML(
		`Your private key is <b>${walletDetails?.privateKey}</b>\n\n This message will be deleted in one minute `,
	).then((message) => {
		const messageId = message.message_id;

		setTimeout(() => {
			ctx.deleteMessage(messageId);
		}, 60000);
	});
});

bot.action("walletaddress", (ctx) => {
	if (!ctx.from) return;

	const walletDetails = databases.getUserWalletDetails(ctx.from.id);
	//console.log(walletDetails);
	ctx.replyWithHTML(`Your wallet address is <b>${walletDetails?.walletAddress}</b>`);
});

bot.action("checkbalance", checkUserExistence, async (ctx) => {
	const user_id = ctx.from?.id;
	if (!user_id) return;
	const wallet = databases.getUserWalletDetails(user_id);
	if (!wallet) return ctx.reply("No wallet found.");
	if (wallet?.holding.length === 0) {
		const balance = await getEtherBalance(wallet.walletAddress);
		const currentEthPrice = await getEthPrice();

		if (!balance || !currentEthPrice) {
			return ctx.reply("An error occured, please try again later");
		}
		const usdNetworth = parseFloat(balance) * currentEthPrice;
		return ctx.replyWithHTML(`You have no other tokens\nBalance: ${balance} ETH\nNet Worth: $${usdNetworth}`);
	} else {
		if (!wallet.walletAddress) return ctx.reply("No wallet found.");
		const balancesString = await getAllTokenBalances(wallet?.walletAddress, wallet?.holding);
		//console.log(balancesString);
		if (balancesString) ctx.replyWithHTML(balancesString);
	}
});
bot.command("/wallet", checkUserExistence, checkGroup, async (ctx) => {
	const user_id = ctx.from?.id;
	//console.log(user_id);

	if (user_id) {
		if (databases.isWalletNull(user_id)) {
			//ctx.reply("generate wallet");
			await ctx.replyWithHTML(
				`${getGreeting()} ${
					ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name
				}, you don't have a wallet yet`,
				Markup.inlineKeyboard([[Markup.button.callback("Generate wallet", "genwallet")]]),
			);
		} else {
			//ctx.reply("view wallet ad, xport private key,send eth, send kai");
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

	//console.log("hey");
});

export const neww = async () => {
	bot.command("/call", async (ctx) => {
		if (ctx.update.message.chat.type === "private") {
			if (ctx.update.message.from.is_bot) {
				return;
			}
			return ctx.reply("This command cannot be used privately, only in Groups/Channels");
		}
		const commandArgs = ctx.message.text.split(" ").slice(1);
		const ca = commandArgs.join(" ");
		if (!ca) return ctx.reply("You need to send a contract address with your command");
		//.ath.usd
		//market_cap.usd
		//fetchCoinGeckoData;
		//const contracAddress = "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE";
		// fetchCoinGeckoData(contractAddress)
		// 	.then((data) => ctx.reply(data.name))
		// 	.catch((error) => console.error("Error:", error));

		//const coin = await fetchCoin(contractAddress, "base");
		const res = await processToken(ca);
		const coin = res?.token;
		//console.log(coin);

		if (coin) {
			//console.log(contractAddress);
			//const coin = await fetchCoin(contractAddress, "ethereum");
			if (isEmpty(coin))
				return ctx.reply("I couldn't find the token, please check the contract address and try again.");
			selectedCoin = coin;
			const data = await fetchDxToolsPairData(selectedCoin.address, res.chain);
			//console.log(data);
			if (!data) return ctx.reply("An error occurred please try again");
			const newData = {
				...data,
				mcap: data.fdv,
			};
			const response = await queryAi(
				`give the information provided here ${JSON.stringify({
					...coin,
					...newData,
				})}. in a paragraph and send it back alone as a paragraph`,
			);
			ctx.reply(`${selectedCoin.name} with contract address ${selectedCoin.address} has been called`);
			return ctx.reply(response);
			//console.log(selectedCoin);
		} else {
			//console.log(contractAddress);
			return ctx.reply("I couldn't find the token, please check the contract address and try again.");
		}
	});
	bot.command("/ask", checkUserExistence, async (ctx) => {
		const commandArgs = ctx.message.text.split(" ").slice(1);
		const prompt = commandArgs.join(" ");
		if (!prompt) return ctx.reply("You need to send a message with your command");
		if (!selectedCoin) {
			return ctx.reply("There's no token called yet");
		}

		const res = await processToken(selectedCoin.address);

		if (!res) return ctx.reply("An error occured please try again");

		const coin = res?.token;

		//const coin = await fetchCoin(selectedCoin.address, "ethereum");
		//console.log(res?.chain, selectedCoin.address);
		//const data = await getTokenInfo(selectedCoin.symbol);
		const data = await fetchDxToolsPairData(selectedCoin.address, res.chain);
		//console.log(data);
		if (!data) return ctx.reply("An error occurred please try again");

		const userid = ctx.from.id;

		const response = await queryAi(getBuyPrompt(prompt));
		//console.log(response);

		if (response.toLowerCase() === "buy") {
			if (res.chain.toLowerCase() !== "base")
				return ctx.reply(
					"We currrently only support base token trading for now. Please bear with us as we are working on supporting other tokens",
				);
			//send confirmation
			//console.log("buying");
			//Markup.inlineKeyboard
			if (databases.isWalletNull(userid)) {
				return ctx.reply(
					`${
						ctx.from.username || ctx.from.first_name
					}, You have not initialised your wallet, send a dm with /wallet to initialise it`,
				);
			}

			const message = await ctx.telegram.sendMessage(
				ctx.from?.id,
				`You are about to buy ${selectedCoin.name} with contract address ${selectedCoin.address}`,
				Markup.inlineKeyboard([
					Markup.button.callback("Proceed", `proceedbuy_${selectedCoin?.address}`),
					Markup.button.callback("Cancel", "cancel"),
				]),
			);
			bot.action("cancel", (ctx) => {
				ctx.deleteMessage(message.message_id);
				return ctx.reply("This operation has been cancelled");
			});
			return;

			//return ctx.scene.enter("buy-wizard", { address: selectedCoin.address, token: selectedCoin });
			//	const confirmation = await ctx.awaitReply("Please enter the amount you want to buy:");
		} else {
			const response = await queryAi(getSellPrompt(prompt));

			if (response.toLowerCase() === "sell") {
				if (res.chain.toLowerCase() !== "base")
					return ctx.reply(
						"We currrently only support base token trading for now. Please bear with us as we are working on supporting other tokens",
					);
				if (databases.isWalletNull(userid)) {
					return ctx.reply(
						`${
							ctx.from.username || ctx.from.first_name
						}, You have not initialised your wallet, send a dm with /wallet to initialise it.`,
					);
				}
				const message = await ctx.telegram.sendMessage(
					ctx.from?.id,
					`You are about to sell ${selectedCoin.name}`,
					Markup.inlineKeyboard([
						Markup.button.callback("Proceed", `proceedsell_${selectedCoin?.address}`),
						Markup.button.callback("Cancel", "cancel"),
					]),
				);
				bot.action("cancel", (ctx) => {
					ctx.deleteMessage(message.message_id);
					return ctx.reply("This operation has been cancelled");
				});
				return;

				//return ctx.scene.enter("sell-wizard", { address: selectedCoin.address, token: selectedCoin });
			}
			const newData = {
				...data,
				mcap: data.fdv,
			};
			const answer = await queryAi(
				`Answer this question "${prompt}" using information provided here ${JSON.stringify({
					...coin,
					...newData,
				})}. if you can't answer reply with a message indicating that you don't know`,
			);
			return ctx.reply(answer);
		}
	});
};
//const tokenName = ctx.match[1];
/token_(.+)/;
bot.action(/proceedbuy_(.+)/, async (ctx) => {
	const ca = ctx.match[1].split(" ")[0];

	console.log(ca);

	const token = await processToken(ca);

	const time = ctx.match[1].split(" ")[1];
	if (!token) return ctx.reply("An error occured please try again");
	return ctx.scene.enter("buy-wizard", { address: ca, token: token, time: time });
});
bot.action(/proceedsell_(.+)/, async (ctx) => {
	const ca = ctx.match[1].split(" ")[0];

	// console.log(ca);
	// console.log(ctx.match);
	const token = await processToken(ca);
	//	console.log(token);
	const time = ctx.match[1].split(" ")[1];
	if (!token) return ctx.reply("An error occured please try again.");
	return ctx.scene.enter("sell-wizard", { address: ca, token: token, time: time });
});
bot.command("/import", checkGroup, async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const ca = commandArgs.join(" ");
	if (!ca) return ctx.reply("You need to send a contract address with your command.");

	const token = await processToken(ca);
	if (token) {
		//check if tokens with zero balance should be blocked
		ctx.reply(`${token.token?.name} has been imported successfully.`);
		return databases.addUserHolding(ctx.from.id, ca);
	} else {
		return ctx.reply(`Couldn't find the token, Please check the contract address and try again.`);
	}
});
bot.command("/delete", checkGroup, async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const ca = commandArgs.join(" ");
	if (!ca) return ctx.reply("You need to send a contract address with your command.");

	const token = await processToken(ca);
	if (token) {
		//check if tokens with zero balance should be blocked
		databases.removeUserHolding(ctx.from.id, ca);
		ctx.reply(`${token.token?.name} has been deleted successfully.`);
		return;
	} else {
		return ctx.reply(`Couldn't find the token, Please check the contract address and try again.`);
	}
});

const coinActions = () => {
	bot.command("/buy", async (ctx) => {
		const commandArgs = ctx.message.text.split(" ").slice(1);
		const ca = commandArgs.join(" ");
		if (!ca) return ctx.reply("You need to send a contract address with your command.");

		const token = await processToken(ca);
		if (!token) {
			return ctx.reply(`Couldn't find the token, Please check the contract address and try again.`);
		}
		if (token.chain.toLowerCase() !== "base")
			return ctx.reply(
				"We currrently only support base token trading for now. Please bear with us as we are working on supporting other tokens",
			);
		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			`You are about to buy ${token.token.name}`,
			Markup.inlineKeyboard([
				Markup.button.callback(`Proceed`, `proceedbuy_${token?.address}`),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		bot.action("cancel", (ctx) => {
			ctx.deleteMessage(message.message_id);
			return ctx.reply("This operation has been cancelled.");
		});
	});
	bot.command("/sell", async (ctx) => {
		const commandArgs = ctx.message.text.split(" ").slice(1);
		const ca = commandArgs.join(" ");
		if (!ca) return ctx.reply("You need to send a contract address with your command.");
		const token = await processToken(ca);
		if (!token) {
			return ctx.reply(`Couldn't find the token, Please check the contract address and try again.`);
		}
		if (token.chain.toLowerCase() !== "base")
			return ctx.reply(
				"We currrently only support base token trading for now. Please bear with us as we are working on supporting other tokens",
			);
		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			`You are about to sell ${token.token.name}`,
			Markup.inlineKeyboard([
				Markup.button.callback("Proceed", `proceedsell_${token?.address}`),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		bot.action("cancel", (ctx) => {
			ctx.deleteMessage(message.message_id);
			return ctx.reply("This operation has been cancelled.");
		});
	});
};
bot.command("/schedule", async (ctx) => {
	const currentUnixTime = Math.floor(Date.now() / 1000);
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");
	//console.log(prompt);
	if (!prompt) return ctx.reply("You need to send a prompt with your command.");

	let time: string | null;
	time = await queryAi(getTimePrompt(prompt));
	//let time2
	if (time.toLowerCase() === "null") {
		time = extractTimeFromPrompt(prompt);

		if (!time) return ctx.reply("There is no time interval present in your message.");
	}

	const ca = await queryAi(getCaPrompt(prompt));
	if (ca.toLowerCase() === "null") {
		return ctx.reply("There is no contract address present in your prompt.");
	}

	const responseBuy = await queryAi(getBuyPrompt(prompt));
	const responseSell = await queryAi(getSellPrompt(prompt));
	const token = await processToken(ca);
	if (!token) return ctx.reply(`Couldn't find the token, Please check the contract address and try again.`);

	if (token.chain.toLowerCase() !== "base")
		return ctx.reply(
			"We currrently only support base token trading for now. Please bear with us as we are working on supporting other tokens",
		);
	if (responseBuy.toLowerCase() === "buy" && responseSell.toLowerCase() !== "sell") {
		//console.log(ca);

		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			`You are about to schedule a buy for ${token?.token?.name}`,
			Markup.inlineKeyboard([
				Markup.button.callback("Proceed", `proceedbuy_${token?.address} ${time}`),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		bot.action("cancel", (ctx) => {
			ctx.deleteMessage(message.message_id);
			return ctx.reply("This operation has been cancelled.");
		});
		return;
	} else if (responseSell.toLowerCase() === "sell" && responseBuy.toLowerCase() !== "buy") {
		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			`You are about to schedule a sell for ${token?.token?.name}`,
			Markup.inlineKeyboard([
				Markup.button.callback("Proceed", `proceedsell_${token?.address} ${time}`),
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
				holding: [],
			});

			chatId = ctx.message.chat.id;
			ctx.telegram.sendMessage(
				ctx.message.chat.id,
				`Welcome you have been sucessfully registered use /menu to get started`,
			);
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
