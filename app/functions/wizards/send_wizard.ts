import { Composer, Markup, Scenes } from "telegraf";
import { WizardContext } from "@app/functions/telegraf";

import { getEtherBalance } from "../checkBalance";
import { getEthPrice } from "../helper";
import { queryAi } from "../queryApi";
import { getCaPrompt, getamountprompt } from "../prompt";
import { sendEth } from "../sendEth";
import { getUserWalletDetails } from "../AWSusers";
const initialData = {
	recipientAddress: "",
	amount: "",
	userBalance: "",
	userWallet: null,
	currency: "",
	chain: null,
};

const stepHandler = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

stepHandler.action("sendd", async (ctx) => {
	const { recipientAddress, amount, currency, userWallet, userBalance } = ctx.scene.session.sendStore;

	const ethPrice = await getEthPrice();

	let amountinEth = parseFloat(amount);

	if (currency === "usd") {
		amountinEth = parseFloat(amount) / ethPrice;
	}

	if (parseFloat(userBalance) < amountinEth) {
		ctx.reply("You have insufficient balance to make this transaction");
		return ctx.scene.leave();
	}
	let tx;
	try {
		tx = await sendEth(
			userWallet?.privateKey,
			recipientAddress,
			amountinEth.toFixed(15).toString(),
			ctx.scene.session.sendStore.chain,
			userWallet?.walletAddress,
		);
		if (tx?.hash) {
			if (ctx.scene.session.sendStore.chain === "ethereum") {
				ctx.reply(
					`You sent ${amountinEth.toFixed(10)} ETH\nTransaction hash:<a href= "https://etherscan.io/tx/${
						tx?.hash
					}">${tx?.hash}</a>`,
				);
			} else {
				ctx.reply(
					`You sent ${amountinEth.toFixed(10)} ETH\nTransaction hash:<a href= "https://basescan.org/tx/${
						tx?.hash
					}">${tx?.hash}</a>`,
				);
			}
		} else ctx.reply(`An error occured. Please try again later`);
		return ctx.scene.leave();
	} catch (error) {
		if (tx) ctx.reply(`An error occured.\nTransaction hash: ${tx?.hash} `);
		else ctx.reply(`An error occured. Please try again later`);
		return ctx.scene.leave();
	}
});
stepHandler.action("cancel", async (ctx) => {
	//ctx.scene. leave()
	await ctx.reply("You've cancelled the operation");

	return await ctx.scene.leave();
});
stepHandler2.action("cancel", async (ctx) => {
	//ctx.scene. leave()
	await ctx.reply("You've cancelled the operation");

	return await ctx.scene.leave();
});

export const sendWizard = new Scenes.WizardScene<WizardContext>(
	"send-wizard",
	async (ctx) => {
		//console.log(ctx.from);
		ctx.scene.session.sendStore = JSON.parse(JSON.stringify(initialData));
		if (!ctx.from?.id) {
			ctx.reply("An error occurred please try again");
			return ctx.scene.leave();
		}

		//@ts-ignore
		ctx.scene.session.sendStore.chain = ctx.scene.state.chain;

		const user_id = ctx.from?.id;

		const wallet = await getUserWalletDetails(user_id);

		const userBalance = await getEtherBalance(wallet?.walletAddress);
		const ethprice = await getEthPrice();
		if (!userBalance || !wallet?.walletAddress) {
			ctx.reply("An error occurred (Failed to get balance), please try again.");
			return ctx.scene.leave();
		}
		ctx.scene.session.sendStore.userBalance =
			ctx.scene.session.sendStore.chain === "ethereum" ? userBalance.eth : userBalance.base;

		ctx.scene.session.sendStore.userWallet = wallet;

		await ctx.replyWithHTML(
			`Please send the recipient's Address`,
			Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
		);

		return ctx.wizard.next();
	},
	stepHandler2,

	stepHandler,
	stepHandler,
);

stepHandler2.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;
		const currentEthPrice = await getEthPrice();
		const ca = await queryAi(getCaPrompt(text));
		console.log(ca);
		if (ca.toLowerCase() === "null") {
			// Reply with a warning emoji for invalid input
			await ctx.replyWithHTML(
				"Please provide a valid value.",
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);
			return;
		}
		ctx.scene.session.sendStore.recipientAddress = ca;
		await ctx.replyWithHTML(
			`What amount (in ETH or Usd) of ETH do you want to send, you have ${
				ctx.scene.session.sendStore.userBalance
			} ETH worth $${parseFloat(ctx.scene.session.sendStore.userBalance) * currentEthPrice}`,
			Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
		);

		return ctx.wizard.next();
		//rs ctx.wizard.next();
	}
});

stepHandler.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;
		const am = await queryAi(getamountprompt(text));
		if (am.toLowerCase() === "null") {
			// Reply with a warning emoji for invalid input
			await ctx.replyWithHTML(
				"Please provide a valid value.",
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);
			return;
		} else {
			ctx.scene.session.sendStore.amount = am;
		}

		ctx.scene.session.sendStore.currency = am.toLowerCase().includes("$") ? "usd" : "eth";

		const regex = /-?\d+(\.\d+)?/;

		const matches = am.match(regex);
		if (matches?.[0]) ctx.scene.session.sendStore.amount = matches?.[0];

		let amountinEth = parseFloat(ctx.scene.session.sendStore.amount);
		const ethPrice = await getEthPrice();
		if (ctx.scene.session.sendStore.currency === "usd") {
			amountinEth = parseFloat(ctx.scene.session.sendStore.amount) / ethPrice;
		}
		await ctx.replyWithHTML(
			`Are you sure you want to send ${amountinEth} ETH to <b>${ctx.scene.session.sendStore.recipientAddress}</b>`,
			Markup.inlineKeyboard([
				Markup.button.callback("Yes I am sure", "sendd"),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		return ctx.wizard.next();
	}
});
