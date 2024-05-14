import { Context, Scenes, Telegraf } from "telegraf";
import configs from "@configs/config";
import { TokenData } from "./timePriceData";

// Extend Session with store containing type of data to store
interface MyWizardSession extends Scenes.WizardSessionData {
	store: {
		sol_transaction: {
			wallet_address: string;
			amount_to_send: string;
		};
	};
	analysisStore: {
		address: string;
		chain: string | undefined;
		token: TokenData | undefined;
		type: string;
	};
	chartStore: {
		address: string;
		chain: string | undefined;
		timeframe: string;
		token: TokenData | undefined;
	};
	promptStore: {
		prompt: string;
		address: string | null;
		token: TokenData | undefined;
		chain: string | undefined;
		chatHistory: string[][];
	};
	detailsStore: {
		address: string | undefined;
		token: TokenData | undefined;
		chain: string | undefined;
	};
	buyStore: {
		buyAddress: string | null;
		amount: string | null;
		currency: string | null;
		token: TokenData | null;
		time: undefined | string;
	};
	sellStore: {
		sellAddress: string | null;
		amount: string | null;
		currency: string | null;
		token: TokenData | null;
		time: undefined | string;
	};
	sendStore: {
		recipientAddress: string;
		amount: string;
		userBalance: string;
		userWallet: {
			walletAddress: string | null;
			privateKey: string | null;
			mnemonic: string | null;
			holding: string[];
		} | null;
		currency: string;
	};
}

// Create custom context with new Session passed generically
interface WizardContext extends Context {
	scene: Scenes.SceneContextScene<WizardContext, MyWizardSession>;
	wizard: Scenes.WizardContextWizard<WizardContext>;
}

// Pass custom context generically to Telegraf
// This bot will then be passed around your app to either commands or
// actions
const bot = new Telegraf<WizardContext>(configs.telegram.token);
export { WizardContext };
export default bot;
