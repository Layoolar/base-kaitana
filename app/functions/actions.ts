import { bot } from "./wizards";
import { getJoke } from "./commands";
import fetchData, { fetchCoin } from "./fetchCoins";
import { Markup } from "telegraf";
import { queryAi } from "./queryApi";
import { StaticPool } from "node-worker-threads-pool";

import path from "path";
import { createUser, getUserLanguage } from "./AWSusers";

const filePath = path.join(__dirname, "worker.mjs");
//onsole.log(pathh);
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
	const coins = (await fetchData(chain, null)).data;
	//const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.tokenData.name} (${coin.tokenData.symbol})`, `coinbsc_${coin.token}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(`These are the top 10 tokens on the BSC network, Click on a token to get more details`, keyboard);

	bot.action(/coinbsc_(.+)/, async (ctx) => {
		const coinAddress = ctx.match[1];
		let selectedCoin = await fetchCoin(coinAddress, coins[0].network);
		if (!selectedCoin) return;
		for (let key in selectedCoin) {
			if (selectedCoin[key] === null) {
				delete selectedCoin[key];
			}
		}
		//console.log(selectedCoin);
		const message = await queryAi(
			`This is a data response a token. Give a summary of the important information provided here ${JSON.stringify(
				{
					...selectedCoin,
				},
			)}. Don't make mention that you are summarizing a given data in your response. Don't say things like 'According to the data provided'. Send the summary back in few short paragraphs. Only return the summary and nothing else. Also wrap important values with HTML <b> bold tags,
				make the numbers easy for humans to read with commas and add a lot of emojis to your summary to make it aesthetically pleasing, for example add 💰 to price, 💎 to mcap,💦 to liquidity,📊 to volume,⛰to Ath, 📈 to % increase ,📉 to % decrease`,
		);
		ctx.answerCbQuery();
		return await ctx.reply(message);
	});

	// bot.action("cancel", async (ctx) => {
	// 	await ctx.reply("Operation cancelled.");
	// });
});

//uploading to worker node on express migrate to dynamo;
//start from from group
//sending vn before choosing lang
//regex to leave words
//language checking

bot.action("ethtrend", async (ctx) => {
	const chain = "ethereum";
	const coins = (await fetchData(chain, null)).data;
	//	const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.tokenData.name} (${coin.tokenData.symbol})`, `coineth_${coin.token}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(
		`These are the top 10 tokens on the Ethereum network, Click on a token to get more details`,
		keyboard,
	);

	bot.action(/coineth_(.+)/, async (ctx) => {
		const coinAddress = ctx.match[1];
		let selectedCoin = await fetchCoin(coinAddress, coins[0].network);
		for (let key in selectedCoin) {
			if (selectedCoin[key] === null) {
				delete selectedCoin[key];
			}
		}
		//	console.log(selectedCoin);
		const message = await queryAi(
			`This is a data response a token. Give a summary of the important information provided here ${JSON.stringify(
				{
					...selectedCoin,
				},
			)}. Don't make mention that you are summarizing a given data in your response. Don't say things like 'According to the data provided'. Send the summary back in few short paragraphs. Only return the summary and nothing else. Also wrap important values with HTML <b> bold tags,
				make the numbers easy for humans to read with commas and add a lot of emojis to your summary to make it aesthetically pleasing, for example add 💰 to price, 💎 to mcap,💦 to liquidity,📊 to volume,⛰to Ath, 📈 to % increase ,📉 to % decrease`,
		);
		ctx.answerCbQuery();
		return await ctx.reply(message);
	});

	// bot.action("cancel", async (ctx) => {
	// 	await ctx.reply("Operation cancelled.");
	// });
});

bot.action("soltrend", async (ctx) => {
	const chain = "solana";
	const coins = (await fetchData(chain, null)).data;
	//	const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.tokenData.name} (${coin.tokenData.symbol})`, `coinsol_${coin.token}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(
		`These are the top 10 tokens on the Solana network, Click on a token to get more details`,
		keyboard,
	);

	bot.action(/coinsol_(.+)/, async (ctx) => {
		const coinAddress = ctx.match[1];
		//let selectedCoin2 = await fetchCoin(coinAddress, coins[0].network);
		const selectedCoin = coins.filter((coin) => coin.token === coinAddress);

		for (let key in selectedCoin) {
			if (selectedCoin[key] === null) {
				delete selectedCoin[key];
			}
		}
		//console.log(selectedCoin);
		const message = await queryAi(
			`This is a data response a token. Give a summary of the important information provided here ${JSON.stringify(
				{
					...selectedCoin,
				},
			)}. Don't make mention that you are summarizing a given data in your response. Don't say things like 'According to the data provided'. Send the summary back in few short paragraphs. Only return the summary and nothing else. Also wrap important values with HTML <b> bold tags,
				make the numbers easy for humans to read with commas and add a lot of emojis to your summary to make it aesthetically pleasing, for example add 💰 to price, 💎 to mcap,💦 to liquidity,📊 to volume,⛰to Ath, 📈 to % increase ,📉 to % decrease`,
		);
		//ctx.telegram.answer_callback_query;
		ctx.answerCbQuery();
		return await ctx.reply(message);
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
	if (!ctx.from?.id) return ctx.reply("Forbidden");
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
		await ctx.reply(
			{
				english: "Welcome! You have been successfully registered. Use /help to get started.",
				french: "Bienvenue ! Vous avez été enregistré avec succès. Utilisez /help pour commencer.",
				spanish: "¡Bienvenido! Te has registrado exitosamente. Usa /help para empezar.",
				arabic: "مرحبًا! لقد تم تسجيلك بنجاح. استخدم /help للبدء.",
				chinese: "欢迎！您已成功注册。使用 /help 开始。",
			}[language],
		);
	} catch (error) {}

	// Add logic to set the user's language based on the extracted language
});

export { bot };
