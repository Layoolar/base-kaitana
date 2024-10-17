import { Composer, Markup, Scenes } from "telegraf";
import { WizardContext } from "@app/functions/telegraf";

import { getEtherBalance } from "../checkBalance";
import { getEthPrice, getSolPrice } from "../helper";
import { queryAi } from "../queryApi";
import { getCaPrompt, getamountprompt } from "../prompt";
import { sendEth } from "../sendEth";
import { getUserWalletDetails } from "../AWSusers";
import { getSolBalance } from "../checksolbalance";
import { sendSolTrasaction, sendSplToken } from "../newsolana";
import { connection, handleSendSol } from "../solhelper";
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

	if (!userWallet?.solPrivateKey || !userWallet.solWalletAddress) return;
	const solPrice = await getSolPrice();

	let amountinSol = parseFloat(amount);

	if (currency === "usd") {
		amountinSol = parseFloat(amount) / solPrice;
	}

	if (parseFloat(userBalance) < amountinSol) {
		ctx.reply("You have insufficient balance to make this transaction\n <i> Session exited...</i>");
		return ctx.scene.leave();
	}
	let tx;
	try {
		// tx = await sendEth(
		// 	userWallet?.privateKey,
		// 	recipientAddress,
		// 	amountinEth.toFixed(15).toString(),
		// 	ctx.scene.session.sendStore.chain,
		// 	userWallet?.walletAddress,
		// );
		tx = await handleSendSol(
			userWallet.solPrivateKey,
			userWallet.solWalletAddress,
			amountinSol,
		);
		if(!tx.hash){
			ctx.reply(`An error occured. Please try again later\n <i> Session exited...</i>`);
		}
		
		else ctx.reply(`Transaction sent hash:${tx.hashUrl}`)

		return ctx.scene.leave();
	} catch (error) {
		if (tx) ctx.reply(`An error occured.\nTransaction hash: ${tx?.hash} `);
		else ctx.reply(`An error occured. Please try again later\n <i> Session exited...</i>`);
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
			ctx.reply("An error occurred please try again\n <i> Session exited...</i>");
			return ctx.scene.leave();
		}

		//@ts-ignore
		ctx.scene.session.sendStore.chain = ctx.scene.state.chain;

		const user_id = ctx.from?.id;

		const wallet = await getUserWalletDetails(user_id);
		if (!wallet) {
			ctx.reply("An error occurred (Failed to get wallet), please try again.\n <i> Session exited...</i>");
			return ctx.scene.leave();
		}

		const userBalance = await getSolBalance(wallet?.solWalletAddress);
	
		if (!userBalance || !wallet?.walletAddress) {
			ctx.reply("An error occurred (Failed to get balance), please try again.\n <i> Session exited...</i>");
			return ctx.scene.leave();
		}
		ctx.scene.session.sendStore.userBalance = userBalance.toString();

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
		const currentSolPrice = await getSolPrice();
		const ca = await queryAi(getCaPrompt(text));

		if (ca.toLowerCase() === "null") {
			// Reply with a warning emoji for invalid input
			await ctx.replyWithHTML(
				"Please provide a valid value.",
				Markup.inlineKeyboard([Markup.button.callback("Cancel", "cancel")]),
			);
			return;
		}
		//ll
		ctx.scene.session.sendStore.recipientAddress = ca;
		await ctx.replyWithHTML(
			`What amount (in SOL or Usd) of SOL do you want to send, you have ${
				ctx.scene.session.sendStore.userBalance
			} SOL worth $${parseFloat(ctx.scene.session.sendStore.userBalance) * currentSolPrice}`,
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

		ctx.scene.session.sendStore.currency = am.toLowerCase().includes("$") ? "usd" : "sol";

		const regex = /-?\d+(\.\d+)?/;

		const matches = am.match(regex);
		if (matches?.[0]) ctx.scene.session.sendStore.amount = matches?.[0];

		let amountinSol = parseFloat(ctx.scene.session.sendStore.amount);
		const solPrice = await getSolPrice();
		if (ctx.scene.session.sendStore.currency === "usd") {
			amountinSol = parseFloat(ctx.scene.session.sendStore.amount) / solPrice;
		}

		await ctx.replyWithHTML(
			`Are you sure you want to send ${amountinSol} SOL to <b>${ctx.scene.session.sendStore.recipientAddress}</b>`,
			Markup.inlineKeyboard([
				Markup.button.callback("Yes I am sure", "sendd"),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		
		return ctx.wizard.next();
	}
});
