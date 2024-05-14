import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";

const initialData = {
	sol_transaction: {
		wallet_address: "",
		amount_to_send: "",
	},
};

const stepHandler = new Composer<WizardContext>();

stepHandler.action("pre_send", async (ctx) => {
	if (ctx.from) {
		const { wallet_address, amount_to_send } = ctx.scene.session.store.sol_transaction;
		await ctx.replyWithHTML(
			`Are you sure you want to make this transaction?\n\n<i>Wallet Address: <b>${wallet_address}</b>\nAmount: <b>${amount_to_send}</b></i>`,
			Markup.inlineKeyboard([
				Markup.button.callback("Yes I am sure", "send"),
				Markup.button.callback("Cancel", "cancel"),
			]),
		);
		return ctx.wizard.next();
	} else {
		await ctx.replyWithHTML("<b>Transaction failed</b>");
	}
	return await ctx.scene.leave();
});

stepHandler.action("send", async (ctx) => {
	if (ctx.from) {
		const { wallet_address, amount_to_send } = ctx.scene.session.store.sol_transaction;
		// Use send function here
		await ctx.replyWithHTML(
			`You sent\n\n<i>Amount: <b>${amount_to_send}</b></i>\n<b>TO</b>\n<i>Wallet Address: <b>${wallet_address}</b></i>`,
		);
	} else {
		await ctx.replyWithHTML("<b>Transaction failed</b>");
	}
	return await ctx.scene.leave();
});
stepHandler.action("cancel", async (ctx) => {
	await ctx.reply("You've cancelled the operation");
	return await ctx.scene.leave();
});

export const transactionWizard = new Scenes.WizardScene<WizardContext>(
	"transaction-wizard",
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		await ctx.replyWithHTML("<b>1. Please submit the wallet address: </b>");
		//ctx.scene.session.store.sol_transaction = initialData;
		return ctx.wizard.next();
	},
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		if (ctx.message && "text" in ctx.message) {
			const { text: address } = ctx.message;
			// Checks, validations and edge cases can be handled here for address
			if (address.length) {
				ctx.scene.session.store.sol_transaction.wallet_address = address;
				await ctx.replyWithHTML("<b>2. Please submit token amount: </b>");
				return ctx.wizard.next();
			} else {
				await ctx.replyWithHTML(
					"<i>1. You need to provide a wallet address.\nPlease submit wallet address: </i>",
				);
			}
		}
	},
	async (ctx) => {
		if (ctx.from) {
			if (ctx.message && "text" in ctx.message) {
				const { text: amount } = ctx.message;
				// Checks, validations and edge cases can be handled here for amount
				if (amount.length) {
					ctx.scene.session.store.sol_transaction.amount_to_send = amount;
					const { wallet_address, amount_to_send } = ctx.scene.session.store.sol_transaction;
					ctx.replyWithHTML(
						`<b>Confirm your Transaction</b>\n\n<i>Wallet Address: <b>${wallet_address}</b>\nAmount: <b>${amount_to_send}</b></i>`,
						Markup.inlineKeyboard([
							Markup.button.callback("Send", "pre_send"),
							Markup.button.callback("Cancel", "cancel"),
						]),
					);
					return ctx.wizard.next();
				} else {
					await ctx.replyWithHTML("<i>2. You need to provide an amount.\nPlease submit token amount: </i>");
				}
			}
		}
	},
	stepHandler,
	stepHandler,
);
