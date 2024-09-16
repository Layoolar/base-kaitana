import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { fetchCoin } from "../fetchCoins";
import { processToken } from "../helper";

import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";

const stepHandler = new Composer<WizardContext>();

export const prebuyWizard = new Scenes.WizardScene<WizardContext>(
	"prebuy-wizard",
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
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
			if (address.length && resp.toLowerCase() !== "null") {
				const res = await processToken(address);
				const token = res?.token;

				if (!token) {
					await ctx.reply(
						"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
					);
					return ctx.scene.leave();
				}

				const ca = address.trim();

				if (res.chain.toLowerCase() !== "ethereum" && res.chain.toLowerCase() !== "base") {
					await ctx.reply(
						"We currently only support trading on Ethereum for now. Please bear with us as we are working on supporting other tokens.\n <i> Session exited...</i>",
					);
					ctx.scene.leave();
				}
				ctx.scene.leave();
				return await ctx.scene.enter("buy-wizard", { address: ca, token: res, time: null, amount: null });
			} else {
				await ctx.replyWithHTML("Invalid contract address\n Exiting session...");
				return ctx.scene.leave();
			}
		}
	},
	stepHandler,
);
const cancelFn = async (ctx: WizardContext) => {
await ctx.replyWithHTML(`<b><i>Session Exited...</i></b>\nThank you for using ParrotAI. See you soon.`);

	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelFn);
