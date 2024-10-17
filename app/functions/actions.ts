import { bot } from "./wizards";
import { formatNumber, getJoke } from "./commands";
import fetchData, { fetchCoin } from "./fetchCoins";
import { Markup } from "telegraf";
import { analyzeImageWithGPT, queryAi } from "./queryApi";
import { StaticPool } from "node-worker-threads-pool";
import axios from "axios";
import path from "path";
import { createUser, getUserLanguage } from "./AWSusers";
import { processToken } from "./helper";
import { getCaPrompt } from "./prompt";

const filePath = path.join(__dirname, "worker.mjs");

export const pool = new StaticPool({
	size: 2,
	task: filePath,
	workerData: "workerData!",
});

bot.action("send_token", async (ctx) => {
	return await ctx.scene.enter("transaction-wizard");
});

bot.action("sendeth", async (ctx) => {
	await ctx.replyWithHTML(
		`What chain are you sending on`,
		Markup.inlineKeyboard([Markup.button.callback("Base", "base"), Markup.button.callback("ETH Mainnet", "eth")]),
	);
});

bot.action("base", async (ctx) => {
	return await ctx.scene.enter("send-wizard", { chain: "base" });
});

bot.action("eth", async (ctx) => {
	return await ctx.scene.enter("send-wizard", { chain: "ethereum" });
});
bot.action("analysis", async (ctx) => {
	return await ctx.scene.enter("analysis-wizard");
});
bot.action("chart", async (ctx) => {
	return await ctx.scene.enter("chart-wizard");
});

bot.action("prompt", async (ctx) => {
	return await ctx.scene.enter("prompt-wizard");
});
bot.action("details", async (ctx) => {
	return await ctx.scene.enter("details-wizard");
});

bot.action("bsctrend", async (ctx) => {
	const chain = "bsc";
	const coins = (await fetchData(chain)).tokens;
	// const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.name} (${coin.symbol})`, `coinbsc_${coin.address}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(`These are the top 10 tokens on the BSC network, Click on a token to get more details`, keyboard);

	bot.action(/coinbsc_(.+)/, async (ctx) => {
		const coinAddress = ctx.match[1];

		const res = await processToken(coinAddress);

		const coin = res?.token;
		if (!coin) {
			return;
		}

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

<code>${coin?.address}</code>
`;
		// ctx.telegram.answer_callback_query;
		ctx.answerCbQuery();
		return await ctx.replyWithHTML(response2);
	});

	// bot.action("cancel", async (ctx) => {
	// 	await ctx.reply("Operation cancelled.");
	// });
});

// uploading to worker node on express migrate to dynamo;
// start from from group
// sending vn before choosing lang
// regex to leave words
// language checking

bot.action("ethtrend", async (ctx) => {
	const chain = "ethereum";
	const coins = (await fetchData(chain)).tokens;
	//	const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.name} (${coin.symbol})`, `coineth_${coin.address}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(
		`These are the top 10 tokens on the Ethereum network, Click on a token to get more details`,
		keyboard,
	);

	bot.action(/coineth_(.+)/, async (ctx) => {
		const coinAddress = ctx.match[1];
		const res = await processToken(coinAddress);
		const coin = res?.token;
		if (!coin) {
			return;
		}

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

<code>${coin?.address}</code>
`; // ctx.telegram.answer_callback_query;
		ctx.answerCbQuery();
		return await ctx.replyWithHTML(response2);
	});

	// bot.action("cancel", async (ctx) => {
	// 	await ctx.reply("Operation cancelled.");
	// });
});

bot.action("soltrend", async (ctx) => {
	const chain = "solana";
	const coins = (await fetchData(chain)).tokens;
	//	const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.name} (${coin.symbol})`, `coinsol_${coin.address}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(
		`These are the top 10 tokens on the Solana network, Click on a token to get more details`,
		keyboard,
	);

	bot.action(/coinsol_(.+)/, async (ctx) => {
		const coinAddress = ctx.match[1];

		const res = await processToken(coinAddress);

		const coin = res?.token;
		if (!coin) {
			return;
		}

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

<code>${coin?.address}</code>
`;

		// ctx.telegram.answer_callback_query;
		ctx.answerCbQuery();
		return await ctx.replyWithHTML(response2);
	});

	// bot.action("cancel", async (ctx) => {
	// 	await ctx.reply("Operation cancelled.");
	// });
});

// bot.action("joke", async (ctx) => {
// 	const joke = await getJoke();
// 	if (joke) {
// 		return ctx.reply(joke);
// 	}
// });

// audio prompts and exit session button under each reply.
// info for the dm.
// language english french chinese spanish arabic
// group is only english

bot.on("voice", async (ctx) => {
	const userId = ctx.from.id;

	const userLanguage = await getUserLanguage(userId);

	if (ctx.chat.type !== "private") {
		return ctx.reply(
			{
				english: "Voice commands can only be used in private chat.",
				french: "Les commandes vocales ne peuvent être utilisées que dans un chat privé.",
				spanish: "Los comandos de voz solo se pueden usar en un chat privado.",
				arabic: "يمكن استخدام الأوامر الصوتية في الدردشة الخاصة فقط.",
				chinese: "语音命令只能在私人聊天中使用。",
			}[userLanguage],
		);
	}

	const voice = ctx.message.voice;
	if (voice.duration > 10) {
		return ctx.reply(
			{
				english: "Maximum duration is 10 seconds.",
				french: "La durée maximale est de 10 secondes.",
				spanish: "La duración máxima es de 10 segundos.",
				arabic: "المدة القصوى هي 10 ثوانٍ.",
				chinese: "最长持续时间为10秒。",
			}[userLanguage],
		);
	}

	try {
		const res = await pool.exec({ voice, userId });

		return await ctx.scene.enter("prompt-wizard", { prompt: res });
	} catch (error) {
		console.log("this error", error);
		await ctx.reply("Failed to transcribe audio.");
	}
});

bot.action(/language_(.+)$/, async (ctx) => {
	const language = ctx.match[1].toLowerCase() as "english" | "french" | "spanish" | "arabic" | "chinese"; // This extracts the language part from the callback data
	await ctx.reply(`You selected ${language}.`);
	if (!ctx.from?.id) {
		return ctx.reply("Forbidden");
	}
	try {
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
			language: language,
		});
		// Reply to the user
		await ctx.replyWithPhoto(
			{
				english: `Welcome to Fortuna Ai🦜\n\nThe best sniper and purchasing bot on ETH.\n\nCommands:\n/help\n/buy\n/sell\n/info\n/analysis`,
				french: "Bienvenue ! Vous avez été enregistré avec succès. Utilisez /help pour commencer.",
				spanish: "¡Bienvenido! Te has registrado exitosamente. Usa /help para empezar.",
				arabic: "مرحبًا! لقد تم تسجيلك بنجاح. استخدم /help للبدء.",
				chinese: "欢迎！您已成功注册。使用 /help 开始。",
			}[language],
		);
	} catch (error) {}

	// Add logic to set the user's language based on the extracted language
});
bot.command("exit", (ctx) => {
	ctx.reply("This session has been cancelled");
	ctx.scene.leave(); // This forces the bot to exit any active wizard or scene
});

bot.on("photo", async (ctx) => {
	try {
		// 'photo' array contains different sizes of the image, we can get the largest by accessing the last element
		const photo = ctx.message.photo[ctx.message.photo.length - 1];

		// Get file_id of the photo
		const fileId = photo.file_id;

		// Get the file link from Telegram
		const fileUrl = await ctx.telegram.getFileLink(fileId);

		const res = await analyzeImageWithGPT(fileUrl.href);

		if (res === "null") return ctx.reply("No contract address detected in your image");

		await ctx.scene.enter("tx_info-wizard", { address: res });
	} catch (error) {
		console.error("Error processing photo:", error);
		await ctx.reply("Sorry, there was an error processing your photo.");
	}
});

export { bot };
