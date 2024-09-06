import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { fetchCoin } from "../fetchCoins";
import { processToken } from "../helper";
import { formatNumber } from "../commands";
import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";
import { addUserHolding, removeUserHolding } from "../AWSusers";

const stepHandler = new Composer<WizardContext>();

export const deleteWizard = new Scenes.WizardScene<WizardContext>(
	"delete-wizard",
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		await ctx.replyWithHTML("<b>What is the contract address of the token you want to delete? </b>");
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

				await removeUserHolding(ctx.from.id, ca, res?.chain);
				await ctx.reply(`${token.name} has been deleted successfully.`);

				return ctx.scene.leave();
			} else {
				await ctx.replyWithHTML("Invalid contract address\n <i> Session exited...</i>");
				return ctx.scene.leave();
			}
		}
	},
	stepHandler,
);

const cancelFn = async (ctx: WizardContext) => {
	await ctx.replyWithHTML("<i> Session exited...</i>");

	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelFn);
