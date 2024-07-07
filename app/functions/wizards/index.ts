import { Scenes, session } from "telegraf";
import { WizardContext } from "@app/functions/telegraf";
import bot from "../telegraf";
import { transactionWizard } from "./transaction_wizard";

import { chartWizard } from "./chart_wizard";
import { promptWizard } from "./prompt_wizard";
import { detailstWizard } from "./details_wizard";
import { buyWizard } from "./buywizard";
import { sellWizard } from "./sellwizard";
import { analysisWizard } from "./analysis_wizard";
import { sendWizard } from "./send_wizard";

const stage = new Scenes.Stage<WizardContext>([
	transactionWizard,
	analysisWizard,
	chartWizard,
	promptWizard,
	detailstWizard,
	buyWizard,
	sellWizard,
	sendWizard,
]);

bot.use(session());
bot.use(stage.middleware());

export { bot };
