import { WizardContext } from "@app/functions/telegraf";
import { Composer, Markup, Scenes } from "telegraf";
import { fetchCoin } from "../fetchCoins";
import { processToken } from "../helper";
import { formatNumber } from "../commands";
import { queryAi } from "../queryApi";
import { getCaPrompt } from "../prompt";
import { addUserHolding } from "../AWSusers";

const stepHandler = new Composer<WizardContext>();

export const importWizard = new Scenes.WizardScene<WizardContext>(
	"import-wizard",
	async (ctx) => {
		if (!ctx.from) {
			return await ctx.scene.leave();
		}
		await ctx.replyWithHTML("<b>What is the contract address of the token you want to import? </b>");
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
					await ctx.reply("I couldn't find the token, unsupported chain, or wrong contract address.");
					return ctx.scene.leave();
				}

				const ca = address.trim();

				await ctx.reply(`${token.name} has been imported successfully.`);

				await addUserHolding(ctx.from.id, ca, res?.chain);

				return ctx.scene.leave();
			} else {
				await ctx.replyWithHTML(
					"Invalid contract address\n Exiting session...",
					Markup.inlineKeyboard([Markup.button.callback("Exit Session", "cancel")]),
				);
				return ctx.scene.leave();
			}
		}
	},
	stepHandler,
);

const cancelFn = async (ctx: WizardContext) => {
	const exitMessage = await queryAi("send me a goodbye message");
	if (exitMessage) {
		await ctx.replyWithHTML(exitMessage);
	}
	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelFn);
