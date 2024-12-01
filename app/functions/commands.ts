/**
 * Telegraf Commands
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */

import { bot } from "./actions";
import { Markup, MiddlewareFn, Context } from "telegraf";
import * as databases from "./databases";
import config, { telegram } from "../configs/config";
import { launchPolling, launchWebhook } from "./launcher";
import { createSolWallet } from "./solhelper";

import path from "path";
import { queryAi } from "./queryApi";
import { TokenData } from "./timePriceData";

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
import {
	addUserHolding,
	createUser,
	getUser,
	getUserLanguage,
	getUserWalletDetails,
	isWalletAddressNull,
	removeUserHolding,
	updateSolWallet,
	updateWallet,
} from "./AWSusers";
import { addGroup, getCurrentCalled, updateCurrentCalledAndCallHistory } from "./awsGroups";
import { getTransactions, updateLog, updateTransaction } from "./awslogs";

export const formatNumber = (num: number) => {
	if (num < 1000) {
		return num.toString();
	}

	const suffixes = ["", "k", "m", "b", "t"];
	const suffixIndex = Math.floor(Math.log10(num) / 3);

	const formattedNum = (num / Math.pow(1000, suffixIndex)).toFixed(1).replace(/\.0$/, "");

	return `${formattedNum}${suffixes[suffixIndex]}`;
};
export interface Log {
	ca: string;
	token: TokenData;
	date: string;
	queries: number;
}
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

export type Token = {
	address: string;
	decimals: number;
	liquidity: number;
	logoURI: string;
	name: string;
	symbol: string;
	volume24hUSD: number;
	rank: number;
};

export type Data = {
	updateUnixTime: number;
	updateTime: string;
	tokens: Token[];
	total: number;
};

// let selectedCoin: any = null;
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
const groupId = -4005329091;
// bot.use(async (ctx, next) => {
// 	if (ctx.chat?.type === "private") {
// 		try {
// 			if (!ctx.from?.id) return;

// 			const chatMember = await ctx.telegram.getChatMember(groupId, ctx.from?.id);

// 			if (chatMember.status !== "left" && chatMember.status !== "kicked") {
// 				return next();
// 			} else {
// 				ctx.replyWithHTML(
// 					`You must be a member of the <a href="https://t.me/parrotaientry">Parrot</a> group to use this bot.`,
// 				);
// 			}
// 		} catch (error) {
// 			console.error("Error checking group membership:", error);
// 			await ctx.reply("An error occurred while verifying your group membership.");
// 		}
// 	} else {
// 		return next();
// 	}
// });

export async function getJoke() {
	try {
		// Call the queryAi function to retrieve a joke
		const joke = await queryAi("reply with a joke");
		return joke;
	} catch (error) {
		// Handle errors if any
		// console.log("Error fetching joke:", error);
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
	if (!ctx.from) {
		return;
	}

	const userLanguage = await getUserLanguage(ctx.from?.id);

	const translations = {
		english: "You already have a wallet",
		french: "Vous avez déjà un portefeuille",
		spanish: "Ya tienes una cartera",
		arabic: "لديك بالفعل محفظة",
		chinese: "你已经有一个钱包",
	};

	if (!ctx.from) {
		return;
	}

	if (await isWalletAddressNull(ctx.from.id)) {
		return next();
	}

	return await ctx.reply(translations[userLanguage]);
};
export const checkUserExistence: MiddlewareFn<Context> = async (ctx: Context, next: () => Promise<void>) => {
	const translations = {
		english: 'You are not yet registered send "/start" to the bot privately to get started.',
		french: 'Vous n\'êtes pas encore enregistré, envoyez "/start" au bot en privé pour commencer.',
		spanish: 'Todavía no estás registrado, envía "/start" al bot en privado para empezar.',
		arabic: 'لم تقم بالتسجيل بعد، أرسل "/start" إلى الروبوت بشكل خاص للبدء.',
		chinese: '您尚未注册，请私密发送"/start"给机器人以开始。',
	};

	if (!ctx.from) {
		return;
	}
	if (!ctx.from) {
		return;
	}
	const userLanguage = await getUserLanguage(ctx.from.id);

	const user = await getUser(ctx.from?.id);
	if (!user) {
		ctx.reply(translations.english);
		return;
	}
	await next();
};
const checkGroup: MiddlewareFn<Context> = async (ctx, next) => {
	if (!ctx.from) {
		return;
	}

	const userLanguage = await getUserLanguage(ctx.from.id);
	const translations = {
		english: "This command can only be sent as a direct message",
		french: "Cette commande ne peut être envoyée que sous forme de message direct",
		spanish: "Este comando solo se puede enviar como mensaje directo",
		arabic: "هذا الأمر يمكن إرساله فقط كرسالة مباشرة",
		chinese: "此命令只能作为直接消息发送",
	};
	const chatType = ctx.chat?.type;

	if (chatType != "private") {
		ctx.reply(translations[userLanguage]);
	} else {
		next();
	}
};
// const checkGroupIdMiddleware: MiddlewareFn<Context> = (ctx, next) => {
// 	/c/ Replace 'YOUR_GROUP_ID' with the actual group ID
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
	console.error("Global error handler:", error);
});

// caption: `Welcome to <b>Parrot AI</b>\n\n<i>The best sniper and purchasing bot on ETH.</i>\n\n<b>Commands:</b>\n<b>⌨️ /help</b>\n<b>🟢 /buy</b>\n<b>🔴 /sell</b>\n<b>ℹ️ /info</b>\n<b>📊 /ta</b>\n🔫<b>/snipe</b> - Coming Soon\n\n<b>🌐 Website: </b>https://parrotbot.lol/\n<b>📖Manual: </b>https://docs.parrotbot.io\n<b>📣 Announcements: </b>https://t.me/parrotannouncements\n<b>💬 Telegram: </b> https://t.me/Parrotbot_Portal`,

const commands = {
	english: {
		"🟢 /buy": "Buy tokens",
		"🔴 /sell": "Sell tokens",
		"👝 /wallet": "Manage your wallet",
		"ℹ️ /info": "Get information about a token",
		"📊 /analysis": "Analyse a token",
		"🕥 /schedule": "Schedule trade.",
		"📈 /trending": "Check trending tokens",
		"💬 Voice": "Send a voice note to the bot (max 10 seconds), spelling out the token name or ticker",
		"🖼 Image": "Send any screenshot or pic containing an address to the bot for information",
	},
	french: {
		"/start": "Envoyez cette commande en privé au bot pour vous inscrire et commencer",
		"/call":
			"<b>(NE PEUT ÊTRE UTILISÉ QUE DANS DES GROUPES)</b> Cette commande est utilisée pour interroger un jeton et le mettre en avant pour obtenir les détails ou le trader.\nFormat d'utilisation : /call {adresse du contrat}",
		"/ask": "<b>(NE PEUT ÊTRE UTILISÉ QUE DANS DES GROUPES)</b> Cette commande est utilisée pour poser des questions sur le jeton appelé et <b>trader</b> le jeton appelé, lorsque vous indiquez acheter ou vendre dans votre message.\nFormat d'utilisation : /ask {votre question}",
		"/schedule":
			"Cette commande est utilisée pour planifier des transactions.\nFormat d'utilisation : /schedule je veux acheter/vendre {adresse du contrat} dans une heure",
		"/import":
			"Cette commande est utilisée en privé pour importer des jetons dans votre portefeuille.\nFormat d'utilisation : /import {adresse du contrat}",
		"/delete":
			"Cette commande est utilisée en privé pour supprimer des jetons de votre portefeuille.\nFormat d'utilisation : /delete {adresse du contrat}",
		"/buy": "Cette commande peut être utilisée pour acheter des jetons.\nFormat d'utilisation : /buy {votre message pour acheter}",
		"/sell":
			"Cette commande peut être utilisée pour vendre des jetons.\nFormat d'utilisation : /sell {votre message pour vendre}",
		"/wallet":
			"Cette commande peut être utilisée en privé pour gérer votre portefeuille.\nFormat d'utilisation : /wallet",
		"/info": "Obtenez des informations sur un jeton en privé.\nFormat d'utilisation : /info {adresse du contrat}",
		"/analysis": "Analyser un jeton en privé.\nFormat d'utilisation : /analysis",
		"/trending": "Vérifiez les tokens tendance sur Eth, Bsc et Sol. \nFormat d'utilisation: /trending",
		"Commandes Vocales":
			"Envoyez une note vocale au bot (maximum 10 secondes) pour demander un jeton ou poser d'autres questions sur le jeton sélectionné. Vous pouvez réenregistrer si l'audio n'est pas ce que vous vouliez. Le bot répondra avec les jetons trouvés basés sur votre enregistrement vocal. \nUtilisation: Envoyez une note vocale au bot en privé.",
	},
	spanish: {
		"/start": "Envía este comando en privado al bot para registrarte y empezar",
		"/call":
			"<b>(SOLO SE PUEDE USAR EN GRUPOS)</b> Este comando se utiliza para consultar un token y ponerlo en el centro de atención para obtener los detalles o comerciar.\nFormato de uso: /call {dirección del contrato}",
		"/ask": "<b>(SOLO SE PUEDE USAR EN GRUPOS)</b> Este comando se utiliza para hacer preguntas sobre el token llamado y <b>comerciar</b> el token llamado, cuando indicas comprar o vender en tu mensaje.\nFormato de uso: /ask {tu pregunta}",
		"/schedule":
			"Este comando se utiliza para programar operaciones.\nFormato de uso: /schedule quiero comprar/vender {dirección del contrato} en una hora",
		"/import":
			"Este comando se utiliza en privado para importar tokens a tu billetera.\nFormato de uso: /import {dirección del contrato}",
		"/delete":
			"Este comando se utiliza en privado para eliminar tokens de tu billetera.\nFormato de uso: /delete {dirección del contrato}",
		"/buy": "Este comando se puede usar para comprar tokens.\nFormato de uso: /buy {tu mensaje para comprar}",
		"/sell": "Este comando se puede usar para vender tokens.\nFormato de uso: /sell {tu mensaje para vender}",
		"/wallet": "Este comando se puede usar en privado para gestionar tu billetera.\nFormato de uso: /wallet",
		"/info": "Obtén información sobre un token en privado.\nFormato de uso: /info {dirección del contrato}",
		"/analysis": "Analiza un token en privado.\nFormato de uso: /analysis",
		"/trending": "Consulta los tokens de tendencia en Eth, Bsc y Sol. \nFormato de uso: /trending",
		"Comandos de Voz":
			"Envía una nota de voz al bot (máximo 10 segundos) para solicitar un token o hacer más preguntas sobre el token seleccionado. Puedes volver a grabar si el audio no es lo que querías. El bot responderá con los tokens encontrados basados en tu grabación de voz. \nUso: Envía una nota de voz al bot de forma privada.",
	},
	arabic: {
		"/start": "أرسل هذا الأمر بشكل خاص إلى الروبوت للتسجيل والبدء",
		"/call":
			"<b>(يمكن استخدامه فقط في المجموعات)</b> يتم استخدام هذا الأمر لاستعلام عن رمز مميز وجعله محور التركيز للحصول على التفاصيل أو التداول.\nتنسيق الاستخدام: /call {عنوان العقد}",
		"/ask": "<b>(يمكن استخدامه فقط في المجموعات)</b> يتم استخدام هذا الأمر لطرح الأسئلة حول الرمز المميز المدعو و <b>التداول</b> بالرمز المميز المدعو، عندما تشير إلى الشراء أو البيع في رسالتك.\nتنسيق الاستخدام: /ask {سؤالك}",
		"/schedule":
			"يستخدم هذا الأمر لجدولة التداول.\nتنسيق الاستخدام: /schedule أريد شراء/بيع {عنوان العقد} في غضون ساعة",
		"/import":
			"يستخدم هذا الأمر بشكل خاص لاستيراد الرموز المميزة إلى محفظتك.\nتنسيق الاستخدام: /import {عنوان العقد}",
		"/delete": "يستخدم هذا الأمر بشكل خاص لحذف الرموز المميزة من محفظتك.\nتنسيق الاستخدام: /delete {عنوان العقد}",
		"/buy": "يمكن استخدام هذا الأمر لشراء الرموز المميزة.\nتنسيق الاستخدام: /buy {رسالتك للشراء}",
		"/sell": "يمكن استخدام هذا الأمر لبيع الرموز المميزة.\nتنسيق الاستخدام: /sell {رسالتك للبيع}",
		"/wallet": "يمكن استخدام هذا الأمر بشكل خاص لإدارة محفظتك.\nتنسيق الاستخدام: /wallet",
		"/info": "احصل على معلومات حول رمز مميز بشكل خاص.\nتنسيق الاستخدام: /info {عنوان العقد}",
		"/analysis": "تحليل رمز مميز بشكل خاص.\nتنسيق الاستخدام: /analysis",
		"/trending": "تحقق من الرموز الرائجة على Eth و Bsc و Sol. \nصيغة الاستخدام: /trending",
		"أوامر صوتية":
			"أرسل ملاحظة صوتية إلى البوت (بحد أقصى 10 ثوانٍ) لطلب رمز مميز أو لطرح المزيد من الأسئلة حول الرمز المحدد. يمكنك إعادة التسجيل إذا لم يكن الصوت كما تريد. سيجيب البوت بالرموز التي تم العثور عليها بناءً على التسجيل الصوتي الخاص بك. \nالاستخدام: أرسل ملاحظة صوتية إلى البوت بشكل خاص.",
	},
	chinese: {
		"/start": "私下向机器人发送此命令以注册并开始",
		"/call":
			"<b>(只能在群组中使用)</b> 此命令用于查询代币并将其集中以获取详细信息或进行交易。\n使用格式：/call {合约地址}",
		"/ask": "<b>(只能在群组中使用)</b> 此命令用于询问有关所调用代币的问题，并在提示中指示买卖时<b>交易</b>所调用的代币。\n使用格式：/ask {你的问题}",
		"/schedule": "此命令用于安排交易。\n使用格式：/schedule 我想在一小时内买/卖 {合约地址}",
		"/import": "此命令用于私下将代币导入您的钱包。\n使用格式：/import {合约地址}",
		"/delete": "此命令用于私下从您的钱包中删除代币。\n使用格式：/delete {合约地址}",
		"/buy": "此命令可用于购买代币。\n使用格式：/buy {您的购买提示}",
		"/sell": "此命令可用于出售代币。\n使用格式：/sell {您的销售提示}",
		"/wallet": "此命令可用于私下管理您的钱包。\n使用格式：/wallet",
		"/info": "私下获取有关代币的信息。\n使用格式：/info {合约地址}",
		"/analysis": "私下分析代币。\n使用格式：/analysis",
		"/trending": "查看 Eth、Bsc 和 Sol 上的热门代币。\n使用格式：/trending",
		语音命令:
			"向机器人发送语音消息（最长 10 秒）以请求令牌或询问有关所选令牌的更多问题。如果录音不是你想要的，你可以重新录制。机器人会根据你的语音录音回复找到的令牌。\n使用：私下发送语音消息给机器人。",
	},
};

bot.help(async (ctx) => {
	if (!ctx.from) {
		return;
	}
	const userLanguage = await getUserLanguage(ctx.from.id);
	const translations = {
		english: "Here are some available commands:",
		french: "Voici quelques commandes disponibles :",
		spanish: "Aquí tienes algunos comandos disponibles:",
		arabic: "إليك بعض الأوامر المتاحة:",
		chinese: "以下是一些可用的命令：",
	};

	const commandsList = await Promise.all(
		Object.entries(commands[userLanguage]).map(async ([command, description]) => {
			return `${command}: ${description}`;
		}),
	).then((commandsWithTranslations) => commandsWithTranslations.join("\n\n"));

	ctx.replyWithHTML(`${translations[userLanguage]}\n\n${commandsList}`);
});

bot.action("genwallet", async (ctx) => {
	const translations = {
		english: "You have already generated a wallet. Use /wallet to view your wallet details.",
		french: "Vous avez déjà généré un portefeuille. Utilisez /wallet pour afficher les détails de votre portefeuille.",
		spanish: "Ya has generado un monedero. Usa /wallet para ver los detalles de tu monedero.",
		arabic: "لقد قمت بتوليد محفظة بالفعل. استخدم /wallet لعرض تفاصيل محفظتك.",
		chinese: "您已经生成了一个钱包。使用 /wallet 查看您的钱包详情。",
	};

	if (!ctx.from) {
		return;
	}

	const userLanguage = await getUserLanguage(ctx.from.id);

	if ((await getUserWalletDetails(ctx.from.id))?.walletAddress) {
		ctx.reply(translations[userLanguage]);
		return;
	}
	ctx.reply(
		{
			english: "Generating Wallet...",
			french: "Génération du portefeuille...",
			spanish: "Generando billetera...",
			arabic: "جاري إنشاء المحفظة...",
			chinese: "生成钱包中...",
		}[userLanguage],
	);
	const wallet = createWallet();
	const solWallet = createSolWallet();

	if (ctx.from) {
		await updateWallet(ctx.from?.id, wallet.walletAddress, wallet.privateKey, wallet.mnemonic);
		await updateSolWallet(ctx.from?.id, solWallet.publicKey, solWallet.privateKeyBase58);
	}

	await ctx
		.replyWithHTML(
			`Wallet generated successfully, your SOL wallet address is: <b><code>${solWallet.publicKey}</code></b>\nPrivate key: <code>${solWallet.privateKeyBase58}</code>.\n\nWallet Address and private keys are above, click on them to copy. This message will be deleted in one minute. You can use /wallet to re-check your wallet details.`,
		)
		.then((message) => {
			const messageId = message.message_id;

			setTimeout(async () => {
				try {
					await ctx.deleteMessage(messageId);
				} catch (error) {
					// console.error(`Failed to delete message ${messageId}:`);
				}
			}, 60000);
		})
		.catch((error) => {
			// console.log(error);
		});
});

bot.action("exportkey", async (ctx) => {
	if (!ctx.from) {
		return;
	}
	if (!ctx.from) {
		return;
	}

	const walletDetails = await getUserWalletDetails(ctx.from.id);
	// const translations = {
	// 	english: `The private key for your SOL wallet is <b><code>${walletDetails?.privateKey}</code></b>\n\nThis message will be deleted in one minute.`,
	// 	french: `La clé privée de votre portefeuille ETH est <b><code>${walletDetails?.privateKey}</code></b>\n\nCe message sera supprimé dans une minute.`,
	// 	spanish: `La clave privada de tu monedero ETH es <b><code>${walletDetails?.privateKey}</code></b>\n\nEste mensaje será eliminado en un minuto.`,
	// 	arabic: `المفتاح الخاص لمحفظتك ETH هو <b><code>${walletDetails?.privateKey}</code></b>\n\nسيتم حذف هذه الرسالة في دقيقة واحدة.`,
	// 	chinese: `您的ETH钱包的私钥为 <b><code>${walletDetails?.privateKey}</code></b>\n\n此消息将在一分钟内被删除。`,
	// };
	await ctx
		.replyWithHTML(
			`The private key for your SOL wallet is <b><code>${walletDetails?.solPrivateKey}</code></b>\n\nThis message will be deleted in one minute.`,
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

	const userLanguage = await getUserLanguage(ctx.from.id);
	const walletDetails = await getUserWalletDetails(ctx.from.id);
	const translations = {
		english: `Your SOL wallet address is <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		french: `Votre adresse de portefeuille ETH est <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		spanish: `Tu dirección de monedero ETH es <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		arabic: `عنوان محفظتك ETH هو <b><code>${walletDetails?.solWalletAddress}</code></b>`,
		chinese: `您的ETH钱包地址为 <b><code>${walletDetails?.solWalletAddress}</code></b>`,
	};
	// / console.log(walletDetails);
	await ctx.replyWithHTML(translations[userLanguage]);
});

bot.action("checkbalance", checkUserExistence, async (ctx) => {
	if (!ctx.from) {
		return;
	}
	const userLanguage = await getUserLanguage(ctx.from.id);
	const translations = {
		english: "Fetching balances...",
		french: "Récupération des soldes...",
		spanish: "Obteniendo saldos...",
		arabic: "جلب الأرصدة...",
		chinese: "正在获取余额...",
	};

	const translations2 = {
		english: "An error occurred, please try again later.",
		french: "Une erreur s'est produite, veuillez réessayer plus tard.",
		spanish: "Ocurrió un error, por favor intenta de nuevo más tarde.",
		arabic: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقًا.",
		chinese: "发生错误，请稍后再试。",
	};
	const translations3 = {
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
	await ctx.reply(translations[userLanguage]);
	const wallet = await getUserWalletDetails(user_id);

	if (!wallet) {
		return await ctx.reply("No wallet found.");
	}
	const tokens = await getSolTokenAccounts(wallet.solWalletAddress);
	if (tokens.length === 0) {
		const balance = await getSolBalance(wallet.solWalletAddress);
		// getSolBalance

		const currentSolPrice = await getSolPrice();

		if (!balance || !currentSolPrice) {
			return ctx.reply(translations2[userLanguage]);
		}
		const usdNetworth = balance * currentSolPrice;
		return ctx.replyWithHTML(
			`${translations3[userLanguage]}\nBalance: <b>${balance.toFixed(
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

bot.command("wallet", checkUserExistence, checkGroup, async (ctx) => {
	const user_id = ctx.from?.id;

	const userLanguage = await getUserLanguage(user_id);
	const translations = {
		english: "You don't have a wallet yet",
		french: "Vous n'avez pas encore de portefeuille",
		spanish: "Aún no tienes un monedero",
		arabic: "ليس لديك محفظة بعد",
		chinese: "您还没有钱包",
	};
	const translations2 = {
		english: "Generate wallet",
		french: "Générer un portefeuille",
		spanish: "Generar monedero",
		arabic: "إنشاء محفظة",
		chinese: "生成钱包",
	};
	if (user_id) {
		if (await isWalletAddressNull(user_id)) {
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
						Markup.button.callback(
							{
								english: "Send Sol",
								french: "Envoyer de l'ETH",
								spanish: "Enviar ETH",
								arabic: "إرسال ETH",
								chinese: "发送ETH",
							}[userLanguage],
							"sendsol",
						),
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
bot.action("sendsol", async (ctx) => {
	await ctx.scene.enter("send-wizard");
	return;
});

export const neww = async () => {
	bot.command("cahfhfhsgdll", async (ctx) => {
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

		// const coin = await fetchCointest();
		const coin = (await processToken(ca))?.token;

		if (!coin) {
			return await ctx.reply("I couldn't find the token, unsupported chain or wrong contract address.");
		}

		if (coin) {
			await updateLog(ca, coin);
			await updateCurrentCalledAndCallHistory(ctx.chat.id, ca);

			if (isEmpty(coin) || !coin.name) {
				return await ctx.reply("I couldn't find the token, unsupported chain or wrong contract address.");
			}

			await ctx.replyWithHTML(
				`<b>Getting Token Information...</b>\n\n<b>Token Name: </b><b><i>${coin.name}</i></b>\n<b>Token Address: </b> <code><i>${coin.address}</i></code>`,
			);

			const extractedData = {
				address: coin.address,
				decimals: coin.decimals,
				symbol: coin.symbol,
				name: coin.name,
				supply: coin.supply,
				mc: coin.mc,
				numberOfMarkets: coin.numberMarkets,
				website: coin.extensions.website ? `<a href ="${coin.extensions.website}">Website</a>` : null,
				twitter: coin.extensions.twitter ? `<a href ="${coin.extensions.twitter}">Twitter</a>` : null,
				telegram: coin.extensions.telegram ? `<a href ="${coin.extensions.telegram}">Telegram</a>` : null,
				discord: coin.extensions.discord ? `<a href ="${coin.extensions.discord}">Discord</a>` : null,
				liquidity: coin.liquidity,
				price: coin.price.toFixed(7),
				priceChange30m: `${coin.priceChange30mPercent.toFixed(2)}%`,
				priceChange1h: `${coin.priceChange1hPercent.toFixed(2)}%`,
				priceChange2h: `${coin.priceChange2hPercent.toFixed(2)}%`,
				priceChange4h: `${coin.priceChange4hPercent.toFixed(2)}%`,
				priceChange6h: `${coin.priceChange6hPercent.toFixed(2)}%`,
				priceChange8h: `${coin.priceChange8hPercent.toFixed(2)}%`,
				priceChange12h: `${coin.priceChange12hPercent.toFixed(2)}%`,
				priceChange24h: `${coin.priceChange24hPercent.toFixed(2)}%`,
			};

			const response = await queryAi(
				`This is a data response a token. reply with bullet points of the data provided here ${JSON.stringify({
					...extractedData,
				})}. you must return the link exactly as they are and you must abreviate the numbers, for example 1m instead of 1,000,000 except the field "price" and emojis after label title, make sure to add the emojis after the label title for example price💰: `,
			);

			return await ctx.replyWithHTML(response);
		} else {
			return await ctx.reply("I couldn't find the token, please check the contract address and try again.");
		}
	});

	bot.command("infoolddd", checkUserExistence, checkGroup, async (ctx) => {
		const commandArgs = ctx.message.text.split(" ").slice(1);
		const ca = commandArgs.join(" ");
		const userId = ctx.from.id;
		const userLanguage = await getUserLanguage(userId);

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
			await updateLog(ca, coin);

			await ctx.replyWithHTML(
				`<b>Getting Token Information...</b>\n\n<b>Token Name: </b><b><i>${coin?.name}</i></b>\n<b>Token Address: </b> <code><i>${coin?.address}</i></code>`,
			);

			const response2 = `🟢<a href="https://birdeye.so/token/${coin?.address}?chain=${
				res.chain
			}"><b>${coin?.name?.toUpperCase()}</b></a> [${formatNumber(coin?.mc)}] $${coin?.symbol?.toUpperCase()}
🌐${res.chain.charAt(0)?.toUpperCase() + res.chain.slice(1)}
💰 USD: <code>$${coin?.price?.toFixed(7)}</code>
💎FDV: <code>${formatNumber(coin?.mc)}</code>
💦 Liq: <code>${coin?.liquidity}</code>
📊 Vol: <code>Vol</code>
📈 1hr: ${coin.priceChange1hPercent ? `${coin.priceChange1hPercent.toFixed(2)}%` : "N/A"}
📉 24h: ${coin.priceChange8hPercent ? `${coin.priceChange8hPercent.toFixed(2)}%` : "N/A"}

<code>${ca}</code>
`;

			return await ctx.replyWithHTML(
				response2,
				Markup.inlineKeyboard([
					Markup.button.callback(
						{
							english: "Buy",
							french: "Acheter",
							spanish: "Comprar",
							arabic: "شراء",
							chinese: "买",
						}[userLanguage],
						`proceedbuy_${coin.address}`,
					),
					Markup.button.callback(
						{
							english: "Sell",
							french: "Vendre",
							spanish: "Vender",
							arabic: "بيع",
							chinese: "卖",
						}[userLanguage],
						`proceedsell_${coin.address}`,
					),
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

	bot.command("ajcjschdhsk", checkUserExistence, async (ctx) => {
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

		const selectedCa = await getCurrentCalled(ctx.chat.id);

		if (!selectedCa) {
			return await ctx.reply("Kindly use /call ${token_address} to start conversation about a token");
		}
		const processedToken = await processToken(selectedCa);
		// console.log(selectedCa);
		const coin = processedToken?.token;

		if (!coin) {
			return await ctx.reply("I couldn't find the token, unsupported chain or wrong contract address.");
		}

		const userid = ctx.from.id;
		const userLanguage = await getUserLanguage(userid);
		await updateLog(selectedCa, coin);
		const response = await queryAi(getBuyPrompt(prompt));
		// console.log(response);

		if (response.toLowerCase() === "buy") {
			// send confirmation
			// console.log("buying");
			// Markup.inlineKeyboard
			if (await isWalletAddressNull(userid)) {
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
			// console.log(`proceedbuy_${selectedCoin?.address}_${amountRes}`);

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
				if (await isWalletAddressNull(userid)) {
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

	if (!userid) {
		return;
	}
	const userLanguage = await getUserLanguage(userid);
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

	if (token.chain.toLowerCase() !== "solana") {
		return await ctx.reply(
			{
				english:
					"We currently only support trading on Solana for now. Please bear with us as we are working on supporting other tokens.",
				french: "Nous prenons actuellement uniquement en charge les échanges sur Ethereum, Binance Smart Chain et Solana pour le moment. Veuillez patienter pendant que nous travaillons à prendre en charge d'autres jetons.",
				spanish:
					"Actualmente solo admitimos operaciones de trading en Ethereum, Binance Smart Chain y Solana. Por favor, tenga paciencia mientras trabajamos en admitir otros tokens.",
				arabic: "نحن ندعم حاليًا التداول فقط على Ethereum و Binance Smart Chain و Solana في الوقت الحالي. يرجى التحلي بالصبر بينما نعمل على دعم رموز أخرى.",
				chinese: "目前我们只支持在以太坊、币安智能链和Solana上交易。请您耐心等待，我们正在努力支持其他代币。",
			}[userLanguage],
		);
	}

	return await ctx.scene.enter("buy-wizard", { address: ca, token: token, time: time, amount: amount });
});
bot.action(/proceedsell_(.+)/, async (ctx) => {
	const userid = ctx.from?.id;

	if (!userid) {
		return;
	}
	const userLanguage = await getUserLanguage(userid);
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
	if (token.chain.toLowerCase() !== "solana") {
		return await ctx.reply(
			{
				english:
					"We currently only support trading on Solana for now. Please bear with us as we are working on supporting other chains.",
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
bot.command("import", async (ctx) => {
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const ca = commandArgs.join(" ");
	const userid = ctx.from?.id;

	if (!userid) {
		return;
	}
	const userLanguage = await getUserLanguage(userid);
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

		return await addUserHolding(ctx.from.id, ca, token.chain);
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
bot.command("delete", checkGroup, async (ctx) => {
	const userid = ctx.from?.id;

	if (!userid) {
		return;
	}
	const userLanguage = await getUserLanguage(userid);
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

		await removeUserHolding(ctx.from.id, ca, token.chain);
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

// bot.command("buy", async (ctx) => {
// 	const commandArgs = ctx.message.text.split(" ").slice(1);
// 	const prompt = commandArgs.join(" ");
// 	const userid = ctx.from?.id;

// 	if (!userid) {
// 		return;
// 	}
// 	const userLanguage = await getUserLanguage(userid);
// 	const ca = await queryAi(getCaPrompt(prompt));
// 	const amount = await queryAi(getamountprompt(prompt));
// 	if (ca.toLowerCase() === "null") {
// 		return await ctx.reply(
// 			{
// 				english: "You need to send a contract address with your command.",
// 				french: "Vous devez envoyer une adresse de contrat avec votre commande.",
// 				spanish: "Debes enviar una dirección de contrato con tu comando.",
// 				arabic: "يجب عليك إرسال عنوان العقد مع الأمر الخاص بك.",
// 				chinese: "您需要在命令中发送合约地址。",
// 			}[userLanguage],
// 		);
// 	}

// 	const token = await processToken(ca);
// 	if (!token) {
// 		return await ctx.reply(
// 			{
// 				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
// 				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
// 				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
// 				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
// 				chinese: "我找不到代币，不支持的链或错误的合约地址。",
// 			}[userLanguage],
// 		);
// 	}

// 	if (!(await getUserWalletDetails(ctx.from.id))?.walletAddress) {
// 		return await ctx.reply(
// 			{
// 				english: `${
// 					ctx.from.username || ctx.from.first_name
// 				}, You do not have an attached wallet, send a direct message with /wallet to initialise it`,
// 				french: `${
// 					ctx.from.username || ctx.from.first_name
// 				}, Vous n'avez pas de portefeuille attaché, envoyez un message direct avec /wallet pour l'initialiser`,
// 				spanish: `${
// 					ctx.from.username || ctx.from.first_name
// 				}, No tienes un monedero adjunto, envía un mensaje directo con /wallet para iniciarlo`,
// 				arabic: `${
// 					ctx.from.username || ctx.from.first_name
// 				}، ليس لديك محفظة مرفقة، أرسل رسالة مباشرة مع /wallet لتهيئتها`,
// 				chinese: `${
// 					ctx.from.username || ctx.from.first_name
// 				}, 您没有附加的钱包，请发送私信并使用 /wallet 来初始化它`,
// 			}[userLanguage],
// 		);
// 	}
// 	if (ctx.chat.type !== "private") {
// 		await ctx.reply(
// 			{
// 				english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
// 				french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
// 				spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
// 				arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
// 				chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
// 			}[userLanguage],
// 		);
// 	}

// 	const message = await ctx.telegram.sendMessage(
// 		ctx.from?.id,
// 		{
// 			english: `You are about to buy ${token.token.name} with contract address ${token.token.address}`,
// 			french: `Vous êtes sur le point d'acheter ${token.token.name} avec l'adresse du contrat ${token.token.address}`,
// 			spanish: `Estás a punto de comprar ${token.token.name} con la dirección del contrato ${token.token.address}`,
// 			arabic: `أنت على وشك شراء ${token.token.name} بعنوان العقد ${token.token.address}`,
// 			chinese: `您即将用合约地址 ${token.token.address} 购买 ${token.token.name}`,
// 		}[userLanguage],
// 		Markup.inlineKeyboard([
// 			Markup.button.callback(
// 				{
// 					english: "Proceed",
// 					french: "Procéder",
// 					spanish: "Proceder",
// 					arabic: "المتابعة",
// 					chinese: "继续",
// 				}[userLanguage],
// 				`proceedbuy_${token?.address} ${amount}`,
// 			),
// 			Markup.button.callback(
// 				{
// 					english: "Cancel",
// 					french: "Annuler",
// 					spanish: "Cancelar",
// 					arabic: "إلغاء",
// 					chinese: "取消",
// 				}[userLanguage],
// 				"cancel",
// 			),
// 		]),
// 	);
// 	bot.action("cancel", async (ctx) => {
// 		await ctx.deleteMessage(message.message_id);
// 		return await ctx.reply(
// 			{
// 				english: "This operation has been cancelled",
// 				french: "Cette opération a été annulée",
// 				spanish: "Esta operación ha sido cancelada",
// 				arabic: "تم إلغاء هذه العملية",
// 				chinese: "此操作已取消",
// 			}[userLanguage],
// 		);
// 	});
// });
// bot.command("sell", async (ctx) => {
// 	const commandArgs = ctx.message.text.split(" ").slice(1);
// 	const prompt = commandArgs.join(" ");
// 	const userid = ctx.from?.id;

// 	if (!userid) {
// 		return;
// 	}
// 	const userLanguage = await getUserLanguage(userid);
// 	const ca = await queryAi(getCaPrompt(prompt));
// 	const amount = await queryAi(getsellamountprompt(prompt));
// 	if (ca.toLowerCase() === "null") {
// 		return await ctx.reply(
// 			{
// 				english: "You need to send a contract address with your command.",
// 				french: "Vous devez envoyer une adresse de contrat avec votre commande.",
// 				spanish: "Debes enviar una dirección de contrato con tu comando.",
// 				arabic: "يجب عليك إرسال عنوان العقد مع الأمر الخاص بك.",
// 				chinese: "您需要在命令中发送合约地址。",
// 			}[userLanguage],
// 		);
// 	}
// 	const token = await processToken(ca);
// 	if (!token) {
// 		return await ctx.reply(
// 			{
// 				english: "I couldn't find the token, unsupported chain, or wrong contract address.",
// 				french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
// 				spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
// 				arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
// 				chinese: "我找不到代币，不支持的链或错误的合约地址。",
// 			}[userLanguage],
// 		);
// 	}
// 	if (!(await getUserWalletDetails(ctx.from.id))?.walletAddress) {
// 		return await ctx.reply("You have not generated a wallet yet, kindly send /wallet command privately");
// 	}
// 	if (ctx.chat.type !== "private") {
// 		await ctx.reply(
// 			{
// 				english: `@${ctx.from.username} You have been sent a confirmation message privately. Kindly confirm in your inbox.`,
// 				french: `@${ctx.from.username} Un message de confirmation vous a été envoyé en privé. Veuillez confirmer dans votre boîte de réception.`,
// 				spanish: `@${ctx.from.username} Se te ha enviado un mensaje de confirmación en privado. Por favor, confirma en tu bandeja de entrada.`,
// 				arabic: `@${ctx.from.username} تم إرسال رسالة تأكيد لك بشكل خاص. يرجى التأكيد في بريدك الوارد.`,
// 				chinese: `@${ctx.from.username} 已私下向您发送确认消息。请在收件箱中确认。`,
// 			}[userLanguage],
// 		);
// 	}

// 	const message = await ctx.telegram.sendMessage(
// 		ctx.from?.id,
// 		{
// 			english: `You are about to sell ${token.token.name}`,
// 			french: `Vous êtes sur le point de vendre ${token.token.name}`,
// 			spanish: `Estás a punto de vender ${token.token.name}`,
// 			arabic: `أنت على وشك بيع ${token.token.name}`,
// 			chinese: `您即将出售 ${token.token.name}`,
// 		}[userLanguage],
// 		Markup.inlineKeyboard([
// 			Markup.button.callback(
// 				{
// 					english: "Proceed",
// 					french: "Procéder",
// 					spanish: "Proceder",
// 					arabic: "المتابعة",
// 					chinese: "继续",
// 				}[userLanguage],
// 				`proceedsell_${token?.address} ${amount}`,
// 			),
// 			Markup.button.callback(
// 				{
// 					english: "Cancel",
// 					french: "Annuler",
// 					spanish: "Cancelar",
// 					arabic: "إلغاء",
// 					chinese: "取消",
// 				}[userLanguage],
// 				"cancel",
// 			),
// 		]),
// 	);
// 	bot.action("cancel", async (ctx) => {
// 		await ctx.deleteMessage(message.message_id);
// 		return await ctx.reply(
// 			{
// 				english: "This operation has been cancelled",
// 				french: "Cette opération a été annulée",
// 				spanish: "Esta operación ha sido cancelada",
// 				arabic: "تم إلغاء هذه العملية",
// 				chinese: "此操作已取消",
// 			}[userLanguage],
// 		);
// 	});
// });
bot.command("schedule", async (ctx) => {
	const currentUnixTime = Math.floor(Date.now() / 1000);
	const commandArgs = ctx.message.text.split(" ").slice(1);
	const prompt = commandArgs.join(" ");
	const userId = ctx.from.id;
	const userLanguage = await getUserLanguage(userId);
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
	if (!(await getUserWalletDetails(ctx.from.id))?.walletAddress) {
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
bot.command("schedule", async (ctx) => {
	await ctx.scene.enter("sc-wizard");
	return;
});
bot.command("analysis", checkGroup, async (ctx) => {
	await ctx.scene.enter("analysis-wizard");
	return;
});
bot.command("buy", checkGroup, async (ctx) => {
	if (!(await getUserWalletDetails(ctx.from.id))?.walletAddress) {
		return await ctx.reply("You have not generated a wallet yet, send /wallet command to initialise your wallet");
	}
	await ctx.scene.enter("prebuy-wizard");
	return;
});
bot.command("sell", checkGroup, async (ctx) => {
	if (!(await getUserWalletDetails(ctx.from.id))?.walletAddress) {
		return await ctx.reply("You have not generated a wallet yet, send /wallet command to initialise your wallet");
	}
	await ctx.scene.enter("presell-wizard");
	return;
});
bot.command("info", checkGroup, async (ctx) => {
	await ctx.scene.enter("info-wizard");
	return;
});

bot.command("i", checkGroup, async (ctx) => {
	await ctx.scene.enter("info-wizard");
	return;
});

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
const buttons = {
	reply_markup: {
		inline_keyboard: [
			[
				{ text: "Ethereum ⚡", callback_data: "ethtrend" },
				{ text: "BSC 🚀", callback_data: "bsctrend" },
				{ text: "Solana 🌊", callback_data: "soltrend" },
			],
		],
	},
};

const menu = async (): Promise<void> => {
	bot.command("trending", checkUserExistence, async (ctx) => {
		ctx.telegram.sendMessage(
			ctx.message.chat.id,
			`Hey ${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name}, select a chain`,
			{
				reply_markup: buttons.reply_markup,
				parse_mode: "HTML",
			},
		);
	});
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
			const existingUser = await getUser(userId); // Replace with your method to get user by ID

			if (existingUser) {
				await ctx.replyWithPhoto(
					{ source: path.join(__dirname, "../assets", "homepage.jpg") }, // Random placeholder image link
					{
						caption: `Welcome to <b>AIthena</b>, I am your trading bot.\n\n<i>AIthena is an enigmatic trading bot, weaving advanced algorithms to unveil the future of a project success like a digital oracle. 🔮</i>\n\n<b>Commands:</b>\n<b>⌨️ /help</b>\n<b>🟢 /buy</b>\n<b>🔴 /sell</b>\n<b>ℹ️ /info</b>\n<b>📊 /analysis</b>\n\n<b>💬 TG:</b>https://t.me/AIthenasolportal\n<b>🌐 WEB: </b>https://www.aithena.xyz\n<b>📖 X:</b>https://x.com/AIthena_\n<b>🤖 BOT: </b>https://t.me/AIthenaSOL_bot \n<b>📣 Announcement: </b>https://t.me/AIthenannouncement`,
						parse_mode: "HTML",
					},
				);
			} else {
				await createUser({
					...ctx.from,
					walletAddress: null,
					bets: [],
					privateKey: null,
					mnemonic: null,
					ethholding: [],
					baseholding: [],
					solWalletAddress: null,
					solPrivateKey: null,
					solMnemonic: null,
					language: "english",
				});

				await ctx.replyWithPhoto(
					{ source: path.join(__dirname, "../assets", "homepage.jpg") }, // Random placeholder image link
					{
						caption: `Welcome to <b>AIthena</b>, I am your trading bot.\n\n<i>AIthena is an enigmatic trading bot, weaving advanced algorithms to unveil the future of a project success like a digital oracle. 🔮</i>\n\n<b>Commands:</b>\n<b>⌨️ /help</b>\n<b>🟢 /buy</b>\n<b>🔴 /sell</b>\n<b>ℹ️ /info</b>\n<b>📊 /analysis</b>\n\n<b>💬 TG:</b>https://t.me/AIthenasolportal\n<b>🌐 WEB: </b>https://www.aithena.xyz\n<b>📖 X:</b>https://x.com/AIthena_\n<b>🤖 BOT: </b>https://t.me/AIthenaSOL_bot \n<b>📣 Announcement: </b>https://t.me/AIthenannouncement`,
						parse_mode: "HTML",
					},
				);
			}
		} else {
			// Handle group chats
			const usernameOrLastName = ctx.message.from.username || ctx.message.from.last_name || "user";
			await ctx.reply(`@${usernameOrLastName}, send a private message to the bot to get started.`);
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
bot.command("stats1997", async (ctx) => {
	// await updateTransaction(1, 0.1);

	const transaction = await getTransactions();
	console.log(transaction);
	// ctx.reply(transaction)
});
const launch = async (): Promise<void> => {
	const mode = config.mode;
	if (mode === "webhook") {
		launchWebhook();
	} else {
		launchPolling();
	}
};

export { launch, quit, start, menu };
export default launch;
