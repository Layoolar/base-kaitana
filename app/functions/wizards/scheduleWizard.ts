import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { fetchCoin } from "../fetchCoins";
import { processToken } from "../helper";

import { queryAi } from "../queryApi";
import { getBuyPrompt, getCaPrompt, getTimePrompt, getSellPrompt } from "../prompt";

const stepHandler = new Composer<WizardContext>();

const initialData = {
	res: null,
	time: undefined,
	operation: "",
};
export const scheduleWizard = new Scenes.WizardScene<WizardContext>(
	"sc-wizard",
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		ctx.scene.session.scStore = JSON.parse(JSON.stringify(initialData));
		await ctx.replyWithHTML("<b>What is the contract address of the token you want to buy? </b>");
		//ctx.scene.session.store.sol_transaction = initialData;
		return ctx.wizard.next();
	},
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		if (ctx.message && "text" in ctx.message) {
			const { text: address } = ctx.message;

			const resp = await queryAi(getCaPrompt(address));
			if (address.length && resp !== "null") {
				const res = await processToken(address);
				const token = res?.token;

				if (!token) {
					await ctx.reply(
						"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
					);
					return ctx.scene.leave();
				}

				ctx.scene.session.scStore.res = res;

				const ca = address.trim();

				if (res.chain.toLowerCase() !== "ethereum" && res.chain.toLowerCase() !== "base") {
					await ctx.reply(
						"We currently only support trading on Ethereum for now. Please bear with us as we are working on supporting other tokens.",
					);
					ctx.scene.leave();
				}

				await ctx.reply("What operation do you want to schedule, buy or sell");
				return ctx.wizard.next();
			} else {
				await ctx.replyWithHTML("Invalid contract address\n Exiting session...");
				return ctx.scene.leave();
			}
		}
	},
	stepHandler,
	async (ctx: WizardContext) => {
		if (ctx.message && "text" in ctx.message) {
			const { text } = ctx.message;

			const res = await queryAi(getTimePrompt(text));
			if (res.toLowerCase() === "null") {
				await ctx.replyWithHTML("Invalid response\n Exiting session...");
				return ctx.scene.leave();
			}

			const token = ctx.scene.session.scStore.res;
			ctx.scene.leave();
			return ctx.scene.session.scStore.operation.toLowerCase() === "buy"
				? await ctx.scene.enter("buy-wizard", {
						address: token?.address,
						token: token,
						time: res,
						amount: null,
				  })
				: await ctx.scene.enter("sell-wizard", {
						address: token?.address,
						token: token,
						time: res,
						amount: null,
				  });
		}
	},
);
const cancelFn = async (ctx: WizardContext) => {
	await ctx.replyWithHTML(`<b><i>Session Exited...</i></b>\nThank you for using ParrotAI. See you soon.`);
	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelFn);
const getText = async (ctx: WizardContext) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;

		const buyres = await queryAi(getBuyPrompt(text));
		const sellres = await queryAi(getSellPrompt(text));
		if (buyres.toLowerCase() === "null" && sellres.toLowerCase() === "null") {
			await ctx.replyWithHTML("Invalid response\n Exiting session...");
			return ctx.scene.leave();
		}
		buyres.toLowerCase() !== "null"
			? (ctx.scene.session.scStore.operation = buyres.toLowerCase())
			: (ctx.scene.session.scStore.operation = sellres.toLowerCase());

		await ctx.reply("In what time interval do you want your trade to be executed (maximum of 24 hours)");
		ctx.wizard.next();
	}
};

stepHandler.on("text", getText);
