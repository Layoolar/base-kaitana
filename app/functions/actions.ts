import { bot } from "@app/functions/wizards";
import { getGreeting, getJoke } from "./commands";
import fetchData, { fetchCoin } from "./fetchCoins";
import { Markup } from "telegraf";
import { openai, queryAi } from "./queryApi";
import { deleteFile, downloadFile, transcribeAudio } from "./helper";
import { getTrancribedAudioPrompt } from "./prompt";

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

bot.action("bsc", async (ctx) => {
	const chain = "bsc";
	const coins = (await fetchData(chain, null)).data;
	//const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.tokenData.name} (${coin.tokenData.symbol})`, `coinbsc_${coin.token}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(
		`Hey ${getGreeting()}, These are the top 10 tokens on the BSC network, Click on a token to get more details`,
		keyboard,
	);

	bot.action(/coinbsc_(.+)/, async (ctx) => {
		const coinAddress = ctx.match[1];
		let selectedCoin = await fetchCoin(coinAddress, coins[0].network);
		for (let key in selectedCoin) {
			if (selectedCoin[key] === null) {
				delete selectedCoin[key];
			}
		}
		//console.log(selectedCoin);
		const message = await queryAi(
			`reply with the name, address,price,liquidity in this token "${JSON.stringify(
				selectedCoin,
			)}" in a paragraph`,
		);
		ctx.answerCbQuery();
		return await ctx.reply(message);
	});

	// bot.action("cancel", async (ctx) => {
	// 	await ctx.reply("Operation cancelled.");
	// });
});

bot.action("eth", async (ctx) => {
	const chain = "ethereum";
	const coins = (await fetchData(chain, null)).data;
	//	const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.tokenData.name} (${coin.tokenData.symbol})`, `coineth_${coin.token}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(
		`Hey ${getGreeting()}, These are the top 10 tokens on the Ethereum network, Click on a token to get more details`,
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
			`reply with the name, address,price,liquidity in this token "${JSON.stringify(
				selectedCoin,
			)}" in a paragraph`,
		);
		ctx.answerCbQuery();
		return await ctx.reply(message);
	});

	// bot.action("cancel", async (ctx) => {
	// 	await ctx.reply("Operation cancelled.");
	// });
});

bot.action("sol", async (ctx) => {
	const chain = "solana";
	const coins = (await fetchData(chain, null)).data;
	//	const cancelButton = Markup.button.callback(`Cancel`, `cancel`);
	const buttons = coins.map((coin) => [
		Markup.button.callback(`${coin.tokenData.name} (${coin.tokenData.symbol})`, `coinsol_${coin.token}`),
	]);
	const keyboard = Markup.inlineKeyboard([...buttons]);

	await ctx.reply(
		`Hey ${getGreeting()}, These are the top 10 tokens on the Solana network, Click on a token to get more details`,
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
			`reply with the name, address,price,liquidity in this token "${JSON.stringify(
				selectedCoin,
			)}" in a paragraph`,
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

//top 4 without ca
//only ticker
//regex to remove - from text to speech then send to dexscreener and return as array without ca duplication
//button for top 3 get summary , button contains name mcap
//summary has a buy button under
//homeypot data should be appended under summary check tg risk level,risk ishoneypot,flags[];


bot.on("voice",async (ctx) => {
	const voice = ctx.message.voice;
	if(	voice.duration>10){
		return ctx.reply("Maximum duration is 10 seconds");
	}

	try {
		const filePath = await downloadFile(voice.file_id);
		const transcription = await transcribeAudio(filePath);
	
		ctx.reply(`${transcription}`);
		//const aiResponse=await queryAi( getTrancribedAudioPrompt( transcription))

		deleteFile(filePath);
	} catch (error) {
		return ctx.reply("Failed to transcribe audio.");
	}
});

export { bot };
