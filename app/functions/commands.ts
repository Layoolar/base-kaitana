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
	translate,
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

export const checkWallet: MiddlewareFn<Context> = async (ctx: Context, next: () => Promise<void>) => {
	if (!ctx.from) return;

	const userLanguage = databases.getUserLanguage(ctx.from?.id);

	let translations = {
		english: "You already have a wallet",
		french: "Vous avez déjà un portefeuille",
		spanish: "Ya tienes una cartera",
		arabic: "لديك بالفعل محفظة",
		chinese: "你已经有一个钱包",
	};

	if (!ctx.from) {
		return;
	}

	if (databases.isWalletNull(ctx.from.id)) {
		return next();
	}

	return await ctx.reply(translations[userLanguage]);
};
export const checkUserExistence: MiddlewareFn<Context> = async (ctx: Context, next: () => Promise<void>) => {
	let translations = {
		english: 'You are not yet registered send "/start" to the bot privately to get started.',
		french: 'Vous n\'êtes pas encore enregistré, envoyez "/start" au bot en privé pour commencer.',
		spanish: 'Todavía no estás registrado, envía "/start" al bot en privado para empezar.',
		arabic: 'لم تقم بالتسجيل بعد، أرسل "/start" إلى الروبوت بشكل خاص للبدء.',
		chinese: '您尚未注册，请私密发送"/start"给机器人以开始。',
	};

	if (!ctx.from) {
		return;
	}

	const user = databases.checkUserExists(ctx.from?.id);
	if (!user) {
		ctx.reply(translations[databases.getUserLanguage(ctx.from.id)]);
		return;
	}
	await next();
};
const checkGroup: MiddlewareFn<Context> = (ctx, next) => {
	if (!ctx.from) {
		return;
	}
	let translations = {
		english: "This command can only be sent as a direct message",
		french: "Cette commande ne peut être envoyée que sous forme de message direct",
		spanish: "Este comando solo se puede enviar como mensaje directo",
		arabic: "هذا الأمر يمكن إرساله فقط كرسالة مباشرة",
		chinese: "此命令只能作为直接消息发送",
	};
	const chatType = ctx.chat?.type;

	if (chatType != "private") {
		ctx.reply(translations[databases.getUserLanguage(ctx.from?.id)]);
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

bot.help(async (ctx) => {
	let translations = {
		english: "Here are some available commands:",
		french: "Voici quelques commandes disponibles :",
		spanish: "Aquí tienes algunos comandos disponibles:",
		arabic: "إليك بعض الأوامر المتاحة:",
		chinese: "以下是一些可用的命令：",
	};
	const userLanguage = databases.getUserLanguage(ctx.from.id);

	const commandsList = await Promise.all(
		Object.entries(commands).map(async ([command, description]) => {
			const translatedDescription =
				userLanguage === "english" ? description : await translate(description, userLanguage);
			return `${command}: ${translatedDescription}`;
		}),
	).then((commandsWithTranslations) => commandsWithTranslations.join("\n\n"));

	ctx.replyWithHTML(`${translations[userLanguage]}\n\n${commandsList}`);
});

bot.action("genwallet", async (ctx) => {
	let translations = {
		english: "You have already generated a wallet. Use /wallet to view your wallet details.",
		french: "Vous avez déjà généré un portefeuille. Utilisez /wallet pour afficher les détails de votre portefeuille.",
		spanish: "Ya has generado un monedero. Usa /wallet para ver los detalles de tu monedero.",
		arabic: "لقد قمت بتوليد محفظة بالفعل. استخدم /wallet لعرض تفاصيل محفظتك.",
		chinese: "您已经生成了一个钱包。使用 /wallet 查看您的钱包详情。",
	};

	if (!ctx.from) return;

	const userLanguage = databases.getUserLanguage(ctx.from.id);

	if (databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		ctx.reply(translations[userLanguage]);
		return;
	}
	const wallet = createWallet();
	const solWallet = createSolWallet();

	if (ctx.from) {
		databases.updateWallet(ctx.from?.id, wallet.walletAddress, wallet.privateKey, wallet.mnemonic);
		databases.updateSolWallet(ctx.from?.id, solWallet.publicKey, solWallet.privateKeyBase58);
	}

	let translations2 = {
		english: `Wallet generated successfully, your ETH wallet address is: <b><code>${wallet.walletAddress}</code></b>\nPrivate key: <code>${wallet.privateKey}</code>.\n\nAnd your SOL wallet address is: <b><code>${solWallet.publicKey}</code></b>\nPrivate key: <code>${solWallet.privateKeyBase58}</code> \n\nWallet Address and private keys are above, click on them to copy. This message will be deleted in one minute. You can use /wallet to re-check your wallet details.`,
		french: `Portefeuille généré avec succès, votre adresse de portefeuille ETH est : <b><code>${wallet.walletAddress}</code></b>\nClé privée : <code>${wallet.privateKey}</code>.\n\nEt votre adresse de portefeuille SOL est : <b><code>${solWallet.publicKey}</code></b>\nClé privée : <code>${solWallet.privateKeyBase58}</code> \n\nLes adresses de portefeuille et les clés privées se trouvent ci-dessus, cliquez dessus pour les copier. Ce message sera supprimé dans une minute. Vous pouvez utiliser /wallet pour vérifier à nouveau les détails de votre portefeuille.`,
		spanish: `Monedero generado exitosamente, tu dirección de monedero ETH es: <b><code>${wallet.walletAddress}</code></b>\nClave privada: <code>${wallet.privateKey}</code>.\n\nY tu dirección de monedero SOL es: <b><code>${solWallet.publicKey}</code></b>\nClave privada: <code>${solWallet.privateKeyBase58}</code> \n\nLas direcciones de monedero y las claves privadas están arriba, haz clic en ellas para copiarlas. Este mensaje será eliminado en un minuto. Puedes usar /wallet para volver a verificar los detalles de tu monedero.`,
		arabic: `تم إنشاء المحفظة بنجاح، عنوان محفظتك ETH هو: <b><code>${wallet.walletAddress}</code></b>\nالمفتاح الخاص: <code>${wallet.privateKey}</code>.\n\nوعنوان محفظتك SOL هو: <b><code>${solWallet.publicKey}</code></b>\nالمفتاح الخاص: <code>${solWallet.privateKeyBase58}</code> \n\nعناوين المحافظ والمفاتيح الخاصة أعلاه، انقر فوقها لنسخها. سيتم حذف هذه الرسالة في دقيقة واحدة. يمكنك استخدام /wallet لإعادة التحقق من تفاصيل محفظتك.`,
		chinese: `钱包生成成功，您的ETH钱包地址为：<b><code>${wallet.walletAddress}</code></b>\n私钥：<code>${wallet.privateKey}</code>。\n\n您的SOL钱包地址为：<b><code>${solWallet.publicKey}</code></b>\n私钥：<code>${solWallet.privateKeyBase58}</code> \n\n上方为钱包地址和私钥，请点击以复制。此消息将在一分钟内被删除。您可以使用 /wallet 重新检查您的钱包详情。`,
	};
	await ctx
		.replyWithHTML(translations2[userLanguage])
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
	let translations = {
		english: `The private key for your ETH wallet is <b><code>${walletDetails?.privateKey}</code></b>\n\nThe private key for your Sol wallet is <b><code>${walletDetails?.solPrivateKey}</code></b>\n\nThis message will be deleted in one minute.`,
		french: `La clé privée de votre portefeuille ETH est <b><code>${walletDetails?.privateKey}</code></b>\n\nLa clé privée de votre portefeuille Sol est <b><code>${walletDetails?.solPrivateKey}</code></b>\n\nCe message sera supprimé dans une minute.`,
		spanish: `La clave privada de tu monedero ETH es <b><code>${walletDetails?.privateKey}</code></b>\n\nLa clave privada de tu monedero Sol es <b><code>${walletDetails?.solPrivateKey}</code></b>\n\nEste mensaje será eliminado en un minuto.`,
		arabic: `المفتاح الخاص لمحفظتك ETH هو <b><code>${walletDetails?.privateKey}</code></b>\n\nالمفتاح الخاص لمحفظتك Sol هو <b><code>${walletDetails?.solPrivateKey}</code></b>\n\nسيتم حذف هذه الرسالة في دقيقة واحدة.`,
		chinese: `您的ETH钱包的私钥为 <b><code>${walletDetails?.privateKey}</code></b>\n\n您的Sol钱包的私钥为 <b><code>${walletDetails?.solPrivateKey}</code></b>\n\n此消息将在一分钟内被删除。`,
	};
	await ctx
		.replyWithHTML(translations[databases.getUserLanguage(ctx.from.id)])
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
	let translations = {
		english: `Your ETH wallet address is <b><code>${walletDetails?.walletAddress}</code></b>\n\nYour SOL wallet address is <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		french: `Votre adresse de portefeuille ETH est <b><code>${walletDetails?.walletAddress}</code></b>\n\nVotre adresse de portefeuille SOL est <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		spanish: `Tu dirección de monedero ETH es <b><code>${walletDetails?.walletAddress}</code></b>\n\nTu dirección de monedero SOL es <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		arabic: `عنوان محفظتك ETH هو <b><code>${walletDetails?.walletAddress}</code></b>\n\nعنوان محفظتك SOL هو <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		chinese: `您的ETH钱包地址为 <b><code>${walletDetails?.walletAddress}</code></b>\n\n您的SOL钱包地址为 <b><code>${walletDetails?.solWalletAddress}</code></b>`,
	};
	/// console.log(walletDetails);
	await ctx.replyWithHTML(translations[databases.getUserLanguage(ctx.from.id)]);
});

bot.action("checkbalance", checkUserExistence, async (ctx) => {
	if (!ctx.from) {
		return;
	}
	let translations = {
		english: "What balance do you want to check?",
		french: "Quel solde voulez-vous vérifier?",
		spanish: "¿Qué saldo quieres verificar?",
		arabic: "ما الرصيد الذي ترغب في التحقق منه؟",
		chinese: "您想检查什么余额？",
	};
	await ctx.replyWithHTML(
		`${getGreeting()} ${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name}, ${
			translations[databases.getUserLanguage(ctx.from.id)]
		}`,
		Markup.inlineKeyboard([
			[Markup.button.callback("Base balance", "basebalance")],
			[Markup.button.callback("ETH balance", "ethbalance")],
			[Markup.button.callback("Solana balance", "solbalance")],
		]),
	);
});

bot.action("basebalance", async (ctx) => {
	let translations = {
		english: "Fetching balances...",
		french: "Récupération des soldes...",
		spanish: "Obteniendo saldos...",
		arabic: "جلب الأرصدة...",
		chinese: "正在获取余额...",
	};

	let translations2 = {
		english: "An error occurred, please try again later.",
		french: "Une erreur s'est produite, veuillez réessayer plus tard.",
		spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
		arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
		chinese: "发生错误，请稍后再试。",
	};
	let translations3 = {
		english: "You have no other tokens",
		french: "Vous n'avez pas d'autres jetons",
		spanish: "No tienes otros tokens",
		arabic: "ليس لديك رموز أخرى",
		chinese: "您没有其他代币",
	};

	const user_id = ctx.from?.id;
	if (!user_id) {
		return;
	}
	await ctx.reply(translations[databases.getUserLanguage(user_id)]);
	const wallet = databases.getUserWalletDetails(user_id);

	if (!wallet) {
		return await ctx.reply("No wallet found.");
	}

	if (wallet?.baseholding.length === 0) {
		const balance = await getEtherBalance(wallet.walletAddress);
		const currentEthPrice = await getEthPrice();

		if (!balance || !currentEthPrice) {
			return ctx.reply(translations2[databases.getUserLanguage(user_id)]);
		}
		const usdNetworth = parseFloat(balance.base) * currentEthPrice;
		return ctx.replyWithHTML(
			`${translations3[databases.getUserLanguage(user_id)]}\nBalance: <b>${parseFloat(balance.base).toFixed(
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
	let translations = {
		english: "Fetching balances...",
		french: "Récupération des soldes...",
		spanish: "Obteniendo saldos...",
		arabic: "جلب الأرصدة...",
		chinese: "正在获取余额...",
	};

	let translations2 = {
		english: "An error occurred, please try again later.",
		french: "Une erreur s'est produite, veuillez réessayer plus tard.",
		spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
		arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
		chinese: "发生错误，请稍后再试。",
	};
	let translations3 = {
		english: "You have no other tokens",
		french: "Vous n'avez pas d'autres jetons",
		spanish: "No tienes otros tokens",
		arabic: "ليس لديك رموز أخرى",
		chinese: "您没有其他代币",
	};

	const user_id = ctx.from?.id;
	if (!user_id) {
		return;
	}
	await ctx.reply(translations[databases.getUserLanguage(user_id)]);
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
			return ctx.reply(translations2[databases.getUserLanguage(user_id)]);
		}
		const usdNetworth = balance * currentSolPrice;
		return ctx.replyWithHTML(
			`${translations3[databases.getUserLanguage(user_id)]}\nBalance: <b>${balance.toFixed(
				5,
			)}</b> SOL\nNet Worth: <b>$${usdNetworth.toFixed(5)}</b>`,
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
	let translations = {
		english: "Fetching balances...",
		french: "Récupération des soldes...",
		spanish: "Obteniendo saldos...",
		arabic: "جلب الأرصدة...",
		chinese: "正在获取余额...",
	};
	let translations2 = {
		english: "An error occurred, please try again later.",
		french: "Une erreur s'est produite, veuillez réessayer plus tard.",
		spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
		arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
		chinese: "发生错误，请稍后再试。",
	};
	let translations3 = {
		english: "You have no other tokens",
		french: "Vous n'avez pas d'autres jetons",
		spanish: "No tienes otros tokens",
		arabic: "ليس لديك رموز أخرى",
		chinese: "您没有其他代币",
	};

	const user_id = ctx.from?.id;
	if (!user_id) {
		return;
	}
	await ctx.reply(translations[databases.getUserLanguage(user_id)]);
	const wallet = databases.getUserWalletDetails(user_id);
	if (!wallet) {
		return await ctx.reply("No wallet found.");
	}
	if (wallet?.ethholding.length === 0) {
		const balance = await getEtherBalance(wallet.walletAddress);

		const currentEthPrice = await getEthPrice();

		if (!balance || !currentEthPrice) {
			return await ctx.reply(translations2[databases.getUserLanguage(user_id)]);
		}
		const usdNetworth = parseFloat(balance.eth) * currentEthPrice;
		return await ctx.replyWithHTML(
			`${translations3[databases.getUserLanguage(user_id)]}\nBalance: <b>${parseFloat(balance.eth).toFixed(
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
	const userLanguage = databases.getUserLanguage(user_id);
	let translations = {
		english: "You don't have a wallet yet",
		french: "Vous n'avez pas encore de portefeuille",
		spanish: "Aún no tienes un monedero",
		arabic: "ليس لديك محفظة بعد",
		chinese: "您还没有钱包",
	};
	let translations2 = {
		english: "Generate wallet",
		french: "Générer un portefeuille",
		spanish: "Generar monedero",
		arabic: "إنشاء محفظة",
		chinese: "生成钱包",
	};
	if (user_id) {
		if (databases.isWalletNull(user_id)) {
			// ctx.reply("generate wallet");
			await ctx.replyWithHTML(
				`${getGreeting()} ${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name}, ${
					translations[userLanguage]
				}`,
				Markup.inlineKeyboard([[Markup.button.callback(translations2[userLanguage], "genwallet")]]),
			);
		} else {
			// ctx.reply("view wallet ad, xport private key,send eth, send kai");
			await ctx.replyWithHTML(
				`${getGreeting()} ${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name}`,
				Markup.inlineKeyboard([
					[
						Markup.button.callback(
							{
								english: "Wallet address",
								french: "Adresse du portefeuille",
								spanish: "Dirección del monedero",
								arabic: "عنوان المحفظة",
								chinese: "钱包地址",
							}[userLanguage],
							"walletaddress",
						),
						Markup.button.callback(
							{
								english: "Export private key",
								french: "Exporter la clé privée",
								spanish: "Exportar clave privada",
								arabic: "تصدير المفتاح الخاص",
								chinese: "导出私钥",
							}[userLanguage],
							"exportkey",
						),
					],

					[
						//Markup.button.callback("Send ETH", "sendeth"),
						Markup.button.callback(
							{
								english: "Check balances",
								french: "Vérifier les soldes",
								spanish: "Consultar saldos",
								arabic: "التحقق من الأرصدة",
								chinese: "检查余额",
							}[userLanguage],
							"checkbalance",
						),
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

		if (!coin) {
			return await ctx.reply("I couldn't find the token, unsupported chain or wrong contract address.");
		}

		if (coin) {
			databases.updateCurrentCalledAndPushToHistory(ctx.chat.id, ca);

			if (isEmpty(coin) || !coin.name) {
				return await ctx.reply("I couldn't find the token, unsupported chain or wrong contract address.");
			}

			const data = await getDexPairDataWithAddress(coin.address);

			if (!data) return ctx.reply("An error occurred please try again");

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

	bot.command("/info", checkUserExistence, checkGroup, async (ctx) => {
		const commandArgs = ctx.message.text.split(" ").slice(1);
		const ca = commandArgs.join(" ");
		const userId = ctx.from.id;
		const userLanguage = databases.getUserLanguage(userId);

		if (!ca) {
			return await ctx.reply(
				{
					english: "You need to send a contract address with your command.",
					french: "Vous devez envoyer une adresse de contrat avec votre commande.",
					spanish: "Debes enviar una dirección de contrato con tu comando.",
					arabic: "يجب عليك إرسال عنوان العقد مع الأمر الخاص بك.",
					chinese: "您需要在命令中发送合约地址。",
				}[userLanguage],
			);
		}

		const res = await processToken(ca);
		const coin = res?.token;

		if (!coin) {
			return await ctx.reply(
				{
					english: "I couldn't find the token, unsupported chain, or wrong contract address.",
					french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
					spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
					arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
					chinese: "我找不到代币，不支持的链或错误的合约地址。",
				}[userLanguage],
			);
		}

		if (coin) {
			if (isEmpty(coin) || !coin.name) {
				return await ctx.reply(
					{
						english: "I couldn't find the token, unsupported chain, or wrong contract address.",
						french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
						spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
						arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
						chinese: "我找不到代币，不支持的链或错误的合约地址。",
					}[userLanguage],
				);
			}

			const data = await getDexPairDataWithAddress(coin.address);

			if (!data)
				return ctx.reply(
					{
						english: "An error occurred, please try again later.",
						french: "Une erreur s'est produite, veuillez réessayer plus tard.",
						spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
						arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
						chinese: "发生错误，请稍后再试。",
					}[userLanguage],
				);

			await ctx.replyWithHTML(
				{
					english:
						'<b>"Getting Token Information...</b>\\n\\n<b>Token Name: </b><i>${coin.name}</i>\\n<b>Token Address: </b> <i>${coin.address}</i>',
					french: '<b>"Obtention des informations sur le jeton...</b>\\n\\n<b>Nom du jeton : </b><i>${coin.name}</i>\\n<b>Adresse du jeton : </b> <i>${coin.address}</i>',
					spanish:
						'<b>"Obteniendo información del token...</b>\\n\\n<b>Nombre del token: </b><i>${coin.name}</i>\\n<b>Dirección del token: </b> <i>${coin.address}</i>',
					arabic: '<b>"الحصول على معلومات الرمز...</b>\\n\\n<b>اسم الرمز: </b><i>${coin.name}</i>\\n<b>عنوان الرمز: </b> <i>${coin.address}</i>',
					chinese:
						'<b>"获取代币信息...</b>\\n\\n<b>代币名称: </b><i>${coin.name}</i>\\n<b>代币地址: </b> <i>${coin.address}</i>',
				}[userLanguage],
			);
			const response = await queryAi(
				`This is a data response a token. Give a summary of the important information provided here ${JSON.stringify(
					{
						...coin,
						mcap: data[0].mcap,
					},
				)}. Don't make mention that you are summarizing a given data in your response. Don't say things like 'According to the data provided'. Send the summary back in few short paragraphs. Only return the summary and nothing else. Also wrap important values with HTML <b> bold tags,
				make the numbers easy for humans to read with commas and add a lot of emojis to your summary to make it aesthetically pleasing, for example add 💰 to price, 💎 to mcap,💦 to liquidity,📊 to volume,⛰to Ath, 📈 to % increase ,📉 to % decrease. Reply in ${userLanguage}`,
			);

			return await ctx.replyWithHTML(
				response,
				Markup.inlineKeyboard([
					
					Markup.button.callback(
						{
							english: "buy",
							french: "acheter",
							spanish: "comprar",
							arabic: "شراء",
							chinese: "买",
						}[userLanguage],
						`proceedbuy_${coin.address}`,
					),
					Markup.button.callback(
						{
							english: "sell",
							french: "vendre",
							spanish: "vender",
							arabic: "بيع",
							chinese: "卖",
						}[userLanguage],
						`proceedsell_${coin.address}`,
					),
					,
				]),
			);
			// console.log(selectedCoin);
		} else {
			// console.log(contractAddress);
			return await ctx.reply(
				{
					english: "I couldn't find the token, unsupported chain, or wrong contract address.",
					french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
					spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
					arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
					chinese: "我找不到代币，不支持的链或错误的合约地址。",
				}[userLanguage],
			);
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
		const coin = processedToken?.token;
		if (!coin) return await ctx.reply("I couldn't find the token, unsupported chain or wrong contract address.");

		const userid = ctx.from.id;
		const userLanguage = databases.getUserLanguage(userid);

		const response = await queryAi(getBuyPrompt(prompt));
		// console.log(response);

		if (response.toLowerCase() === "buy") {
			// send confirmation
			// console.log("buying");
			// Markup.inlineKeyboard
			if (databases.isWalletNull(userid)) {
				return await ctx.reply(
					{
						english: `${
							ctx.from.username || ctx.from.first_name
						}, You do not have an attached wallet, send a direct message with /wallet to initialise it`,
						french: `${
							ctx.from.username || ctx.from.first_name
						}, Vous n'avez pas de portefeuille attaché, envoyez un message direct avec /wallet pour l'initialiser`,
						spanish: `${
							ctx.from.username || ctx.from.first_name
						}, No tienes un monedero adjunto, envía un mensaje directo con /wallet para iniciarlo`,
						arabic: `${
							ctx.from.username || ctx.from.first_name
						}، ليس لديك محفظة مرفقة، أرسل رسالة مباشرة مع /wallet لتهيئتها`,
						chinese: `${
							ctx.from.username || ctx.from.first_name
						}, 您没有附加的钱包，请发送私信并使用 /wallet 来初始化它`,
					}[userLanguage],
				);
			}
			ctx.reply(
				{
					english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
					french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
					spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
					arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
					chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
				}[userLanguage],
			);
			const amountRes = await queryAi(getamountprompt(prompt));
			//console.log(`proceedbuy_${selectedCoin?.address}_${amountRes}`);

			const message = await ctx.telegram.sendMessage(
				ctx.from?.id,
				{
					english: `You are about to buy ${coin.name} with contract address ${coin.address}`,
					french: `Vous êtes sur le point d'acheter ${coin.name} avec l'adresse du contrat ${coin.address}`,
					spanish: `Estás a punto de comprar ${coin.name} con la dirección del contrato ${coin.address}`,
					arabic: `أنت على وشك شراء ${coin.name} بعنوان العقد ${coin.address}`,
					chinese: `您即将用合约地址 ${coin.address} 购买 ${coin.name}`,
				}[userLanguage],
				Markup.inlineKeyboard([
					Markup.button.callback(
						{
							english: "Proceed",
							french: "Procéder",
							spanish: "Proceder",
							arabic: "المتابعة",
							chinese: "继续",
						}[userLanguage],
						`proceedbuy_${coin?.address} ${amountRes}`,
					),
					Markup.button.callback(
						{
							english: "Cancel",
							french: "Annuler",
							spanish: "Cancelar",
							arabic: "إلغاء",
							chinese: "取消",
						}[userLanguage],
						"cancel",
					),
				]),
			);
			bot.action("cancel", async (ctx) => {
				await ctx.deleteMessage(message.message_id);
				return await ctx.reply(
					{
						english: "This operation has been cancelled",
						french: "Cette opération a été annulée",
						spanish: "Esta operación ha sido cancelada",
						arabic: "تم إلغاء هذه العملية",
						chinese: "此操作已取消",
					}[userLanguage],
				);
			});
			return;

			// return ctx.scene.enter("buy-wizard", { address: coin.address, token: coin });
			//	const confirmation = await ctx.awaitReply("Please enter the amount you want to buy:");
		} else {
			const response = await queryAi(getSellPrompt(prompt));

			if (response.toLowerCase() === "sell") {
				if (databases.isWalletNull(userid)) {
					return await ctx.reply(
						{
							english: `${
								ctx.from.username || ctx.from.first_name
							}, You do not have an attached wallet, send a direct message with /wallet to initialise it`,
							french: `${
								ctx.from.username || ctx.from.first_name
							}, Vous n'avez pas de portefeuille attaché, envoyez un message direct avec /wallet pour l'initialiser`,
							spanish: `${
								ctx.from.username || ctx.from.first_name
							}, No tienes un monedero adjunto, envía un mensaje directo con /wallet para iniciarlo`,
							arabic: `${
								ctx.from.username || ctx.from.first_name
							}، ليس لديك محفظة مرفقة، أرسل رسالة مباشرة مع /wallet لتهيئتها`,
							chinese: `${
								ctx.from.username || ctx.from.first_name
							}, 您没有附加的钱包，请发送私信并使用 /wallet 来初始化它`,
						}[userLanguage],
					);
				}
				await ctx.reply(
					{
						english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
						french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
						spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
						arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
						chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
					}[userLanguage],
				);

				const amountRes = await queryAi(getsellamountprompt(prompt));
				const message = await ctx.telegram.sendMessage(
					ctx.from?.id,
					{
						english: `You are about to sell ${coin.name}`,
						french: `Vous êtes sur le point de vendre ${coin.name}`,
						spanish: `Estás a punto de vender ${coin.name}`,
						arabic: `أنت على وشك بيع ${coin.name}`,
						chinese: `您即将出售 ${coin.name}`,
					}[userLanguage],
					Markup.inlineKeyboard([
						Markup.button.callback(
							{
								english: "Proceed",
								french: "Procéder",
								spanish: "Proceder",
								arabic: "المتابعة",
								chinese: "继续",
							}[userLanguage],
							`proceedsell_${coin?.address} ${amountRes}`,
						),
						Markup.button.callback(
							{
								english: "Cancel",
								french: "Annuler",
								spanish: "Cancelar",
								arabic: "إلغاء",
								chinese: "取消",
							}[userLanguage],
							"cancel",
						),
					]),
				);
				bot.action("cancel", async (ctx) => {
					await ctx.deleteMessage(message.message_id);
					return await ctx.reply(
						{
							english: "This operation has been cancelled",
							french: "Cette opération a été annulée",
							spanish: "Esta operación ha sido cancelada",
							arabic: "تم إلغاء هذه العملية",
							chinese: "此操作已取消",
						}[userLanguage],
					);
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
	const userid = ctx.from?.id;

	if (!userid) return;
	const userLanguage = databases.getUserLanguage(userid);
	const match = ctx.match;

	const amount = match[1].split(" ")[1] === "null" ? null : match[1].split(" ")[1];

	const ca = ctx.match[1].split(" ")[0];

	const token = await processToken(ca);

	const time = ctx.match[1].split(" ")[2];

	if (!token) {
		return await ctx.reply(
			{
				english: "An error occurred, please try again",
				french: "Une erreur s'est produite, veuillez réessayer",
				spanish: "Se ha producido un error, por favor inténtalo de nuevo",
				arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
				chinese: "发生错误，请重试",
			}[userLanguage],
		);
	}

	if (
		token.chain.toLowerCase() !== "ethereum" &&
		token.chain.toLowerCase() !== "base" &&
		token.chain.toLowerCase() !== "solana"
	) {
		return await ctx.reply(
			{
				english:
					"We currently only support trading on Ethereum, Binance Smart Chain, and Solana for now. Please bear with us as we are working on supporting other tokens.",
				french: "Nous prenons actuellement uniquement en charge les échanges sur Ethereum, Binance Smart Chain et Solana pour le moment. Veuillez patienter pendant que nous travaillons à prendre en charge d'autres jetons.",
				spanish:
					"Actualmente solo admitimos operaciones de trading en Ethereum, Binance Smart Chain y Solana. Por favor, tenga paciencia mientras trabajamos en admitir otros tokens.",
				arabic: "نحن ندعم حاليًا التداول فقط على Ethereum و Binance Smart Chain و Solana في الوقت الحالي. يرجى التحلي بالصبر بينما نعمل على دعم رموز أخرى.",
				chinese: "目前我们只支持在以太坊、币安智能链和Solana上交易。请您耐心等待，我们正在努力支持其他代币。",
			}[userLanguage],
		);
	}

	//console.log(ca, token.chain, time, amount);
	return await ctx.scene.enter("buy-wizard", { address: ca, token: token, time: time, amount: amount });
});
bot.action(/proceedsell_(.+)/, async (ctx) => {
	const userid = ctx.from?.id;

	if (!userid) return;
	const userLanguage = databases.getUserLanguage(userid);
	const match = ctx.match;

	const amount = match[1].split(" ")[1] === "null" ? null : match[1].split(" ")[1];

	const ca = ctx.match[1].split(" ")[0];

	const token = await processToken(ca);

	const time = ctx.match[1].split(" ")[2];

	if (!token) {
		return await ctx.reply(
			{
				english: "An error occurred, please try again",
				french: "Une erreur s'est produite, veuillez réessayer",
				spanish: "Se ha producido un error, por favor inténtalo de nuevo",
				arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
				chinese: "发生错误，请重试",
			}[userLanguage],
		);
	}
	if (
		token.chain.toLowerCase() !== "ethereum" &&
		token.chain.toLowerCase() !== "base" &&
		token.chain.toLowerCase() !== "solana"
	) {
		return await ctx.reply(
			{
				english:
					"We currently only support trading on Ethereum, Binance Smart Chain, and Solana for now. Please bear with us as we are working on supporting other tokens.",
				french: "Nous prenons actuellement uniquement en charge les échanges sur Ethereum, Binance Smart Chain et Solana pour le moment. Veuillez patienter pendant que nous travaillons à prendre en charge d'autres jetons.",
				spanish:
					"Actualmente solo admitimos operaciones de trading en Ethereum, Binance Smart Chain y Solana. Por favor, tenga paciencia mientras trabajamos en admitir otros tokens.",
				arabic: "نحن ندعم حاليًا التداول فقط على Ethereum و Binance Smart Chain و Solana في الوقت الحالي. يرجى التحلي بالصبر بينما نعمل على دعم رموز أخرى.",
				chinese: "目前我们只支持在以太坊、币安智能链和Solana上交易。请您耐心等待，我们正在努力支持其他代币。",
			}[userLanguage],
		);
	}
	return await ctx.scene.enter("sell-wizard", { address: ca, token: token, time: time, amount: amount });
});
bot.command("/import", checkGroup, async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const ca = commandArgs.join(" ");
	const userid = ctx.from?.id;

	if (!userid) return;
	const userLanguage = databases.getUserLanguage(userid);
	if (!ca) {
		return await ctx.reply(
			{
				english: "You need to send a contract address with your command.",
				french: "Vous devez envoyer une adresse de contrat avec votre commande.",
				spanish: "Debes enviar una dirección de contrato con tu comando.",
				arabic: "يجب عليك إرسال عنوان العقد مع الأمر الخاص بك.",
				chinese: "您需要在命令中发送合约地址。",
			}[userLanguage],
		);
	}

	const token = await processToken(ca);

	if (token) {
		// check if tokens with zero balance should be blocked
		await ctx.reply(
			{
				english: `${token.token?.name} has been imported successfully.`,
				french: `${token.token?.name} a été importé avec succès.`,
				spanish: `${token.token?.name} ha sido importado correctamente.`,
				arabic: `تم استيراد ${token.token?.name} بنجاح.`,
				chinese: `${token.token?.name} 已成功导入。`,
			}[userLanguage],
		);
		return databases.addUserHolding(ctx.from.id, ca, token.chain);
	} else {
		return await ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}
});
bot.command("/delete", checkGroup, async (ctx) => {
	const userid = ctx.from?.id;

	if (!userid) return;
	const userLanguage = databases.getUserLanguage(userid);
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const ca = commandArgs.join(" ");
	if (!ca) {
		return await ctx.reply(
			{
				english: "You need to send a contract address with your command.",
				french: "Vous devez envoyer une adresse de contrat avec votre commande.",
				spanish: "Debes enviar una dirección de contrato con tu comando.",
				arabic: "يجب عليك إرسال عنوان العقد مع الأمر الخاص بك.",
				chinese: "您需要在命令中发送合约地址。",
			}[userLanguage],
		);
	}

	const token = await processToken(ca);
	if (token) {
		// check if tokens with zero balance should be blocked
		databases.removeUserHolding(ctx.from.id, ca, token.chain);
		await ctx.reply(
			{
				english: `${token.token?.name} has been deleted successfully.`,
				french: `${token.token?.name} a été supprimé avec succès.`,
				spanish: `${token.token?.name} ha sido eliminado correctamente.`,
				arabic: `تم حذف ${token.token?.name} بنجاح.`,
				chinese: `${token.token?.name} 已成功删除。`,
			}[userLanguage],
		);
		return;
	} else {
		return await ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}
});

const coinActions = () => {};
bot.command("/buy", async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");
	const userid = ctx.from?.id;

	if (!userid) return;
	const userLanguage = databases.getUserLanguage(userid);
	const ca = await queryAi(getCaPrompt(prompt));
	const amount = await queryAi(getamountprompt(prompt));
	if (ca.toLowerCase() === "null") {
		return await ctx.reply(
			{
				english: "You need to send a contract address with your command.",
				french: "Vous devez envoyer une adresse de contrat avec votre commande.",
				spanish: "Debes enviar una dirección de contrato con tu comando.",
				arabic: "يجب عليك إرسال عنوان العقد مع الأمر الخاص بك.",
				chinese: "您需要在命令中发送合约地址。",
			}[userLanguage],
		);
	}

	const token = await processToken(ca);
	if (!token) {
		return await ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}

	if (!databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		return await ctx.reply(
			{
				english: `${
					ctx.from.username || ctx.from.first_name
				}, You do not have an attached wallet, send a direct message with /wallet to initialise it`,
				french: `${
					ctx.from.username || ctx.from.first_name
				}, Vous n'avez pas de portefeuille attaché, envoyez un message direct avec /wallet pour l'initialiser`,
				spanish: `${
					ctx.from.username || ctx.from.first_name
				}, No tienes un monedero adjunto, envía un mensaje directo con /wallet para iniciarlo`,
				arabic: `${
					ctx.from.username || ctx.from.first_name
				}، ليس لديك محفظة مرفقة، أرسل رسالة مباشرة مع /wallet لتهيئتها`,
				chinese: `${
					ctx.from.username || ctx.from.first_name
				}, 您没有附加的钱包，请发送私信并使用 /wallet 来初始化它`,
			}[userLanguage],
		);
	}

	await ctx.reply(
		{
			english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
			french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
			spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
			arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
			chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
		}[userLanguage],
	);

	const message = await ctx.telegram.sendMessage(
		ctx.from?.id,
		{
			english: `You are about to buy ${token.token.name} with contract address ${token.token.address}`,
			french: `Vous êtes sur le point d'acheter ${token.token.name} avec l'adresse du contrat ${token.token.address}`,
			spanish: `Estás a punto de comprar ${token.token.name} con la dirección del contrato ${token.token.address}`,
			arabic: `أنت على وشك شراء ${token.token.name} بعنوان العقد ${token.token.address}`,
			chinese: `您即将用合约地址 ${token.token.address} 购买 ${token.token.name}`,
		}[userLanguage],
		Markup.inlineKeyboard([
			Markup.button.callback(
				{
					english: "Proceed",
					french: "Procéder",
					spanish: "Proceder",
					arabic: "المتابعة",
					chinese: "继续",
				}[userLanguage],
				`proceedbuy_${token?.address} ${amount}`,
			),
			Markup.button.callback(
				{
					english: "Cancel",
					french: "Annuler",
					spanish: "Cancelar",
					arabic: "إلغاء",
					chinese: "取消",
				}[userLanguage],
				"cancel",
			),
		]),
	);
	bot.action("cancel", async (ctx) => {
		await ctx.deleteMessage(message.message_id);
		return await ctx.reply(
			{
				english: "This operation has been cancelled",
				french: "Cette opération a été annulée",
				spanish: "Esta operación ha sido cancelada",
				arabic: "تم إلغاء هذه العملية",
				chinese: "此操作已取消",
			}[userLanguage],
		);
	});
});
bot.command("/sell", async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");
	const userid = ctx.from?.id;

	if (!userid) return;
	const userLanguage = databases.getUserLanguage(userid);
	const ca = await queryAi(getCaPrompt(prompt));
	const amount = await queryAi(getsellamountprompt(prompt));
	if (ca.toLowerCase() === "null") {
		return await ctx.reply(
			{
				english: "You need to send a contract address with your command.",
				french: "Vous devez envoyer une adresse de contrat avec votre commande.",
				spanish: "Debes enviar una dirección de contrato con tu comando.",
				arabic: "يجب عليك إرسال عنوان العقد مع الأمر الخاص بك.",
				chinese: "您需要在命令中发送合约地址。",
			}[userLanguage],
		);
	}
	const token = await processToken(ca);
	if (!token) {
		return await ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}
	if (!databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		return await ctx.reply("You have not generated a wallet yet, kindly send /wallet command privately");
	}
	await ctx.reply(
		{
			english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
			french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
			spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
			arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
			chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
		}[userLanguage],
	);
	const message = await ctx.telegram.sendMessage(
		ctx.from?.id,
		{
			english: `You are about to sell ${token.token.name}`,
			french: `Vous êtes sur le point de vendre ${token.token.name}`,
			spanish: `Estás a punto de vender ${token.token.name}`,
			arabic: `أنت على وشك بيع ${token.token.name}`,
			chinese: `您即将出售 ${token.token.name}`,
		}[userLanguage],
		Markup.inlineKeyboard([
			Markup.button.callback(
				{
					english: "Proceed",
					french: "Procéder",
					spanish: "Proceder",
					arabic: "المتابعة",
					chinese: "继续",
				}[userLanguage],
				`proceedsell_${token?.address} ${amount}`,
			),
			Markup.button.callback(
				{
					english: "Cancel",
					french: "Annuler",
					spanish: "Cancelar",
					arabic: "إلغاء",
					chinese: "取消",
				}[userLanguage],
				"cancel",
			),
		]),
	);
	bot.action("cancel", async (ctx) => {
		await ctx.deleteMessage(message.message_id);
		return await ctx.reply(
			{
				english: "This operation has been cancelled",
				french: "Cette opération a été annulée",
				spanish: "Esta operación ha sido cancelada",
				arabic: "تم إلغاء هذه العملية",
				chinese: "此操作已取消",
			}[userLanguage],
		);
	});
});
bot.command("/schedule", async (ctx) => {
	const currentUnixTime = Math.floor(Date.now() / 1000);
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");
	const userId = ctx.from.id;
	const userLanguage = databases.getUserLanguage(userId);
	// console.log(prompt);
	if (!prompt) {
		return await ctx.reply(
			{
				english: "You need to send a prompt with your command.",
				french: "Vous devez envoyer un message avec votre commande.",
				spanish: "Necesitas enviar un mensaje con tu comando.",
				arabic: "يجب عليك إرسال رسالة مع أمرك.",
				chinese: "您需要在命令中发送提示。",
			}[userLanguage],
		);
	}

	let time: string | null;
	time = await queryAi(getTimePrompt(prompt));
	// let time2
	if (time.toLowerCase() === "null") {
		time = extractTimeFromPrompt(prompt);

		if (!time) {
			return await ctx.reply(
				{
					english: "There is no time interval present in your message.",
					french: "Aucun intervalle de temps n'est présent dans votre message.",
					spanish: "No hay intervalo de tiempo presente en tu mensaje.",
					arabic: "لا يوجد فاصل زمني موجود في رسالتك.",
					chinese: "您的消息中没有时间间隔。",
				}[userLanguage],
			);
		}
	}

	const ca = await queryAi(getCaPrompt(prompt));
	if (ca.toLowerCase() === "null") {
		return ctx.reply(
			{
				english: "There is no contract address present in your prompt.",
				french: "Aucune adresse de contrat n'est présente dans votre message.",
				spanish: "No hay ninguna dirección de contrato presente en tu mensaje.",
				arabic: "لا يوجد عنوان عقد موجود في رسالتك.",
				chinese: "您的消息中没有合约地址。",
			}[userLanguage],
		);
	}

	const responseBuy = await queryAi(getBuyPrompt(prompt));
	const responseSell = await queryAi(getSellPrompt(prompt));
	const token = await processToken(ca);
	if (!token) {
		return await ctx.reply(
			{
				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
				chinese: "我找不到代币，不支持的链或错误的合约地址。",
			}[userLanguage],
		);
	}
	if (!databases.getUserWalletDetails(ctx.from.id)?.walletAddress) {
		return await ctx.reply(
			{
				english: `${
					ctx.from.username || ctx.from.first_name
				}, You do not have an attached wallet, send a direct message with /wallet to initialise it`,
				french: `${
					ctx.from.username || ctx.from.first_name
				}, Vous n'avez pas de portefeuille attaché, envoyez un message direct avec /wallet pour l'initialiser`,
				spanish: `${
					ctx.from.username || ctx.from.first_name
				}, No tienes un monedero adjunto, envía un mensaje directo con /wallet para iniciarlo`,
				arabic: `${
					ctx.from.username || ctx.from.first_name
				}، ليس لديك محفظة مرفقة، أرسل رسالة مباشرة مع /wallet لتهيئتها`,
				chinese: `${
					ctx.from.username || ctx.from.first_name
				}, 您没有附加的钱包，请发送私信并使用 /wallet 来初始化它`,
			}[userLanguage],
		);
	}

	if (responseBuy.toLowerCase() === "buy" && responseSell.toLowerCase() !== "sell") {
		// console.log(ca);
		const amount = await queryAi(getamountprompt(prompt));
		await ctx.reply(
			{
				english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
				french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
				spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
				arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
				chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
			}[userLanguage],
		);
		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			{
				english: `You are about to schedule a buy for ${token?.token?.name}`,
				french: `Vous êtes sur le point de planifier un achat pour ${token?.token?.name}`,
				spanish: `Estás a punto de programar una compra para ${token?.token?.name}`,
				arabic: `أنت على وشك جدولة عملية شراء لـ ${token?.token?.name}`,
				chinese: `您即将为 ${token?.token?.name} 安排购买`,
			}[userLanguage],
			Markup.inlineKeyboard([
				Markup.button.callback(
					{
						english: "Proceed",
						french: "Procéder",
						spanish: "Proceder",
						arabic: "المتابعة",
						chinese: "继续",
					}[userLanguage],
					`proceedbuy_${token?.address} ${amount} ${time}`,
				),
				Markup.button.callback(
					{
						english: "Cancel",
						french: "Annuler",
						spanish: "Cancelar",
						arabic: "إلغاء",
						chinese: "取消",
					}[userLanguage],
					"cancel",
				),
			]),
		);
		bot.action("cancel", async (ctx) => {
			await ctx.deleteMessage(message.message_id);
			return await ctx.reply(
				{
					english: "This operation has been cancelled",
					french: "Cette opération a été annulée",
					spanish: "Esta operación ha sido cancelada",
					arabic: "تم إلغاء هذه العملية",
					chinese: "此操作已取消",
				}[userLanguage],
			);
		});
		return;
	} else if (responseSell.toLowerCase() === "sell" && responseBuy.toLowerCase() !== "buy") {
		const amount = await queryAi(getsellamountprompt(prompt));

		await ctx.reply(
			{
				english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
				french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
				spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
				arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
				chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
			}[userLanguage],
		);
		const message = await ctx.telegram.sendMessage(
			ctx.from?.id,
			{
				english: `You are about to schedule a sell for ${token?.token?.name}`,
				french: `Vous êtes sur le point de planifier une vente pour ${token?.token?.name}`,
				spanish: `Estás a punto de programar una venta para ${token?.token?.name}`,
				arabic: `أنت على وشك جدولة عملية بيع لـ ${token?.token?.name}`,
				chinese: `您即将为 ${token?.token?.name} 安排出售`,
			}[userLanguage],
			Markup.inlineKeyboard([
				Markup.button.callback(
					{
						english: "Proceed",
						french: "Procéder",
						spanish: "Proceder",
						arabic: "المتابعة",
						chinese: "继续",
					}[userLanguage],
					`proceedsell_${token?.address} ${amount} ${time}`,
				),
				Markup.button.callback(
					{
						english: "Cancel",
						french: "Annuler",
						spanish: "Cancelar",
						arabic: "إلغاء",
						chinese: "取消",
					}[userLanguage],
					"cancel",
				),
			]),
		);
		bot.action("cancel", async (ctx) => {
			await ctx.deleteMessage(message.message_id);
			return await ctx.reply(
				{
					english: "This operation has been cancelled",
					french: "Cette opération a été annulée",
					spanish: "Esta operación ha sido cancelada",
					arabic: "تم إلغاء هذه العملية",
					chinese: "此操作已取消",
				}[userLanguage],
			);
		});
		return;
	} else {
		return ctx.reply(
			{
				english: "I couldn't parse your request, please try again.",
				french: "Je n'ai pas pu analyser votre demande, veuillez réessayer.",
				spanish: "No pude analizar tu solicitud, por favor inténtalo de nuevo.",
				arabic: "لم أتمكن من تحليل طلبك، يرجى المحاولة مرة أخرى.",
				chinese: "我无法解析您的请求，请重试。",
			}[userLanguage],
		);
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

const start = async () => {
	bot.start(async (ctx) => {
		// Check if the chat and message objects are defined
		if (!ctx.chat || !ctx.update.message || !ctx.update.message.chat || !ctx.update.message.from) {
			console.error("Chat or message object is not defined");
			return;
		}

		const groupId = ctx.chat.id;
		const userId = ctx.update.message.from.id;
		if (ctx.update.message.chat.type === "private") {
			// Check if the message is from a bot
			if (ctx.update.message.from.is_bot) {
				return;
			}

			// Check if the user is already registered
			const existingUser = databases.checkUserExists(userId); // Replace with your method to get user by ID

			if (existingUser) {
				await ctx.reply(
					{
						english: "You are already registered. Use /help to get started.",
						french: "Vous êtes déjà inscrit. Utilisez /help pour commencer.",
						spanish: "Ya estás registrado. Usa /help para empezar.",
						arabic: "أنت مسجل بالفعل. استخدم /help للبدء.",
						chinese: "您已经注册了。使用 /help 开始。",
					}[databases.getUserLanguage(userId)],
				);
			} else {
				await ctx.replyWithHTML(
					"Please select a language",
					Markup.inlineKeyboard([
						[Markup.button.callback("English", "language_english")],
						[Markup.button.callback("Français", "language_french")],
						[Markup.button.callback("Español", "language_spanish")],
						[Markup.button.callback("中文", "language_chinese")],
						[Markup.button.callback("العربية", "language_arabic")],
					]),
				);

				// Store user data in the database
			}
		} else {
			// Handle group chats
			const usernameOrLastName = ctx.message.from.username || ctx.message.from.last_name || "user";
			await ctx.reply(
				{
					english: `@${usernameOrLastName}, send a private message to the bot to get started.`,
					french: `@${usernameOrLastName}, envoyez un message privé au bot pour commencer.`,
					spanish: `@${usernameOrLastName}, envía un mensaje privado al bot para empezar.`,
					arabic: `@${usernameOrLastName}، أرسل رسالة خاصة إلى الروبوت للبدء.`,
					chinese: `@${usernameOrLastName}，发送私信给机器人开始。`,
				}[databases.getUserLanguage(userId)],
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
