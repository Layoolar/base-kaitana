import { WizardContext } from "../telegraf";

import { Composer, Markup, Scenes } from "telegraf";

import { queryAi } from "../queryApi";
import { getamountprompt } from "../prompt";

import { buyOnBase, buyOnEth } from "../buyfunction";
import type { BigNumber } from "ethers";
import { getEtherBalance } from "../checkBalance";
import { addMillisecondsToDate, delay, getEthPrice, getSolPrice, processToken } from "../helper";
import { TokenData } from "../timePriceData";
import { getSolBalance } from "../checksolbalance";
import { buyTokensWithSolana } from "../solana";

import {
	addUserHolding,
	getUser,
	getUserLanguage,
	getUserWalletDetails,
	isWalletAddressNull,
	removeUserHolding,
	updateSolWallet,
	updateWallet,
} from "../AWSusers";
import { addGroup, getCurrentCalled, updateCurrentCalledAndCallHistory } from "../awsGroups";
import { updateLog, updateTransaction } from "../awslogs";
import { addtoCount } from "../databases";
import { handleSolForToken } from "../solhelper";

export type TransactionReceipt = {
	to: string | null; // Address this transaction is sent to
	from: string; // Address this transaction is sent from
	contractAddress: string | null; // Address of the newly created contract (if applicable)
	transactionIndex: number; // Index of this transaction in the block's list of transactions
	type: number; // Type of transaction (EIP-2718 type)
	gasUsed: BigNumber; // Amount of gas used by this transaction
	effectiveGasPrice: BigNumber; // Effective gas price charged for this transaction
	logsBloom: string; // Bloom filter containing addresses and topics of logs emitted by this transaction
	blockHash: string; // Hash of the block containing this transaction
	transactionHash: string; // Hash of this transaction
	logs: any[]; // Array of logs emitted by this transaction
	blockNumber: number; // Block number containing this transaction
	confirmations: number; // Number of blocks mined since this transaction
	cumulativeGasUsed: BigNumber; // Sum of gas used by all transactions up to this one in the block
	byzantium: boolean; // Indicates if the block is post-Byzantium Hard Fork
	status: number; // Status of the transaction (1 for success, 0 for failure)
};

const initialData = {
	buyAddress: null,
	amount: null,
	currency: null,
	token: null,
	userBalance: null,
	time: undefined,
	language: "",
};

const stepHandler = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

stepHandler.action("sendbuy", async (ctx) => {
	const { buyAddress, token, time, userBalance } = ctx.scene.session.buyStore;
	let tokenAmount: string;
	let amount = ctx.scene.session.buyStore.amount;
	if (!ctx.from?.id) return;
	const userLanguage = ctx.scene.session.buyStore.language;
	if (!buyAddress || !amount || !token || !userBalance) {
		ctx.reply(
			{
				english: "An error occurred, please try again",
				french: "Une erreur s'est produite, veuillez réessayer",
				spanish: "Se ha producido un error, por favor inténtalo de nuevo",
				arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
				chinese: "发生错误，请重试",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}
	const regex = /-?\d+(\.\d+)?/;

	const matches = amount.match(regex);
	// console.log(matches);
	if (matches?.[0]) {
		amount = matches?.[0];
	} else {
		ctx.reply(
			{
				english: "An error occurred, please try again",
				french: "Une erreur s'est produite, veuillez réessayer",
				spanish: "Se ha producido un error, por favor inténtalo de nuevo",
				arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
				chinese: "发生错误，请重试",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}

	// ctx.scene.session.buyStore.currency = amount.toLowerCase().includes("$") ? "usd" : "eth";
	// const currency = ctx.scene.session.buyStore.currency;
	// console.log(amount, currency);

	if (
		ctx.scene.session.buyStore.chain?.toLowerCase() === "ethereum" ||
		ctx.scene.session.buyStore.chain?.toLowerCase() === "base"
	) {
		const ethprice = (await getEthPrice()) as number;

		if (!ethprice) {
			ctx.reply(
				{
					english: "Couldn't get token price",
					french: "Impossible d'obtenir le prix du token",
					spanish: "No se pudo obtener el precio del token",
					arabic: "تعذر الحصول على سعر الرمز",
					chinese: "无法获取代币价格",
				}[userLanguage],
			);
			return ctx.scene.leave();
		}
		tokenAmount = (parseFloat(amount) / ethprice).toString();
	} else if (ctx.scene.session.buyStore.chain?.toLowerCase() === "solana") {
		//tokenAmount = ""
		const solprice = (await getSolPrice()) as number;
		//console.log(solprice);
		if (!solprice) {
			ctx.reply(
				{
					english: "Couldn't get token price",
					french: "Impossible d'obtenir le prix du token",
					spanish: "No se pudo obtener el precio del token",
					arabic: "تعذر الحصول على سعر الرمز",
					chinese: "无法获取代币价格",
				}[userLanguage],
			);
			return ctx.scene.leave();
		}
		tokenAmount = (parseFloat(amount) / solprice).toString();
	} else {
		tokenAmount = "";
	}

	// console.log(amount);

	let receipt;
	if (time) {
		if (parseFloat(time) > 86400000) {
			ctx.reply(
				{
					english: "Error: Maximum interval is 24 hours",
					french: "Erreur : L'intervalle maximum est de 24 heures",
					spanish: "Error: El intervalo máximo es de 24 horas",
					arabic: "خطأ: الحد الأقصى للفترة هو 24 ساعة",
					chinese: "错误：最大间隔为24小时",
				}[userLanguage],
			);
			return ctx.scene.leave();
		}

		const date = addMillisecondsToDate(parseFloat(time));
		ctx.reply(
			{
				english: `Buy has been scheduled for ${date.toTimeString()}`,
				french: `L'achat a été programmé pour ${date.toTimeString()}`,
				spanish: `La compra ha sido programada para ${date.toTimeString()}`,
				arabic: `تم جدولة الشراء لـ ${date.toTimeString()}`,
				chinese: `购买已计划于 ${date.toTimeString()}`,
			}[userLanguage],
		);
		// await delay(parseFloat(time));
		setTimeout(async () => {
			try {
				if (!ctx.scene.session.buyStore.amount) {
					ctx.reply(
						{
							english: "An error occurred, please try again",
							french: "Une erreur s'est produite, veuillez réessayer",
							spanish: "Se ha producido un error, por favor inténtalo de nuevo",
							arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
							chinese: "发生错误，请重试",
						}[userLanguage],
					);
					return ctx.scene.leave();
				}
				// console.log(ctx.from, currency, ctx.scene.session.buyStore.amount, token, buyAddress);
				receipt = await executeBuy(ctx, parseFloat(tokenAmount), token, buyAddress, userBalance);
				// console.log(receipt);
			} catch (error) {
				console.log(error);
				ctx.reply(
					{
						english: "An error occurred, please try again",
						french: "Une erreur s'est produite, veuillez réessayer",
						spanish: "Se ha producido un error, por favor inténtalo de nuevo",
						arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
						chinese: "发生错误，请重试",
					}[userLanguage],
				);
				return await ctx.scene.leave();
			}
		}, parseFloat(time));
	} else {
		ctx.reply(
			{
				english: `Buying ${ctx.scene.session.buyStore.token?.name} ...`,
				french: `Achat de ${ctx.scene.session.buyStore.token?.name} ...`,
				spanish: `Comprando ${ctx.scene.session.buyStore.token?.name} ...`,
				arabic: `شراء ${ctx.scene.session.buyStore.token?.name} ...`,
				chinese: `购买 ${ctx.scene.session.buyStore.token?.name} ...`,
			}[userLanguage],
		);
		try {
			if (!ctx.scene.session.buyStore.amount) {
				ctx.reply(
					{
						english: "An error occurred, please try again",
						french: "Une erreur s'est produite, veuillez réessayer",
						spanish: "Se ha producido un error, por favor inténtalo de nuevo",
						arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
						chinese: "发生错误，请重试",
					}[userLanguage],
				);
				return ctx.scene.leave();
			}
			// 			const executeBuy = async (
			// 	ctx: WizardContext,
			// 	amount: number,
			// 	token: TokenData,
			// 	buyAddress: string,
			// 	userBalance:number
			// )
			//console.log(tokenAmount);

			receipt = await executeBuy(ctx, parseFloat(tokenAmount), token, buyAddress, userBalance);
			// console.log(receipt);
		} catch (error) {
			console.log(error);
			ctx.reply(
				{
					english: "An error occurred, please try again",
					french: "Une erreur s'est produite, veuillez réessayer",
					spanish: "Se ha producido un error, por favor inténtalo de nuevo",
					arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
					chinese: "发生错误，请重试",
				}[userLanguage],
			);
			return await ctx.scene.leave();
		}
	}

	return await ctx.scene.leave();
});
const cancelfn = async (ctx: WizardContext) => {
	if (!ctx.from?.id) return;
	await ctx.reply(
		{
			english: "You've cancelled the operation",
			french: "Vous avez annulé l'opération",
			spanish: "Has cancelado la operación",
			arabic: "لقد قمت بإلغاء العملية",
			chinese: "您已取消操作",
		}[ctx.scene.session.buyStore.language],
	);

	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelfn);
stepHandler2.action("cancel", cancelfn);

export const buyWizard = new Scenes.WizardScene<WizardContext>(
	"buy-wizard",
	async (ctx) => {
		if (!ctx.from?.id) {
			return ctx.scene.leave();
		}
		const user = await getUser(ctx.from.id);
		if (!user) {
			return ctx.scene.leave();
		}
		//const wallet = await getUserWalletDetails(ctx.from.id);
		const userLanguage = user?.language;

		if (!user?.walletAddress) {
			await ctx.reply(
				{
					english: `You do not have an attached wallet, send a direct message with /wallet to initialise it`,
					french: `Vous n'avez pas de portefeuille attaché, envoyez un message direct avec /wallet pour l'initialiser`,
					spanish: `No tienes un monedero adjunto, envía un mensaje directo con /wallet para iniciarlo`,
					arabic: `ليس لديك محفظة مرفقة، أرسل رسالة مباشرة مع /wallet لتهيئتها`,
					chinese: ` 您没有附加的钱包，请发送私信并使用 /wallet 来初始化它`,
				}[userLanguage],
			);
			return ctx.scene.leave();
		}
		ctx.scene.session.buyStore = JSON.parse(JSON.stringify(initialData));

		ctx.scene.session.buyStore.language = userLanguage;
		//{ address: ca, token: token, time: time, amount: amount }
		// @ts-ignore
		ctx.scene.session.buyStore.buyAddress = ctx.scene.state.address;
		// @ts-ignore
		ctx.scene.session.buyStore.token = ctx.scene.state.token.token;

		// @ts-ignore
		ctx.scene.session.buyStore.time = ctx.scene.state.time;

		// @ts-ignore
		ctx.scene.session.buyStore.amount = ctx.scene.state.amount;

		// @ts-ignore
		ctx.scene.session.buyStore.chain = ctx.scene.state.token.chain;

		// const buyAddress = ctx.scene.session.buyStore.buyAddress;
		// console.log(buyAddress);
		//	const amount = ctx.scene.session.buyStore.amount;
		const chain = ctx.scene.session.buyStore.chain;
		//let userBalance;

		if (chain?.toLowerCase() !== "solana") {
			await ctx.reply(
				"We currently only support trading on Solana for now. Please bear with us as we are working on supporting other tokens.\n <i> Session exited...</i>",
			);
			return ctx.scene.leave();
		}

		if (chain === "base") {
			ctx.scene.session.buyStore.currency = "ETH";
			const res = await getEtherBalance(user.walletAddress);
			if (!res) {
				await ctx.reply("Couldn't get balance, please try again\n <i> Session exited...</i>");
				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = parseFloat(res.base);
			//userBalance = res?.base;
		} else if (chain === "solana") {
			ctx.scene.session.buyStore.currency = "SOL";
			const solbalance = await getSolBalance(user.solWalletAddress);
			if (!solbalance) {
				await ctx.reply("Couldn't get wallet balance, please try again\n <i> Session exited...</i>");

				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = solbalance;
		} else {
			ctx.scene.session.buyStore.currency = "ETH";
			const res = await getEtherBalance(user.walletAddress);
			if (!res) {
				await ctx.reply("Couldn't get balance, please try again\n <i> Session exited...</i>");
				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = parseFloat(res.eth);
		}

		//const ethprice = await getEthPrice();

		if (!ctx.scene.session.buyStore.userBalance) {
			if (ctx.scene.session.buyStore.userBalance === 0) {
				ctx.reply(
					{
						english:
							"Wallet balance is currently zero, please fund your wallet and try again\n <i> Session exited...</i>",
						french: "Le solde du portefeuille est actuellement à zéro, veuillez approvisionner votre portefeuille et réessayer",
						spanish:
							"El saldo de la cartera está actualmente en cero, por favor fondee su cartera e intente nuevamente",
						arabic: "رصيد المحفظة حاليًا صفر، يرجى تمويل محفظتك والمحاولة مرة أخرى",
						chinese: "钱包余额当前为零，请充值您的钱包然后重试",
					}[ctx.scene.session.buyStore.language],
				);
				return ctx.scene.leave();
			}
			ctx.reply(
				{
					english: "An error occurred, please try again\n <i> Session exited...</i>",
					french: "Une erreur s'est produite, veuillez réessayer",
					spanish: "Se ha producido un error, por favor inténtalo de nuevo",
					arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
					chinese: "发生错误，请重试",
				}[ctx.scene.session.buyStore.language],
			);
			return ctx.scene.leave();
		}
		//const userBalanceInUsd = userBalance * parseFloat(ethprice);

		if (ctx.scene.session.buyStore.amount) {
			await ctx.replyWithHTML(
				{
					english: `Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>\nAmount: <b>${ctx.scene.session.buyStore.amount} </b>\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					french: `Êtes-vous sûr de vouloir acheter ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Adresse : <b>${ctx.scene.session.buyStore.buyAddress}</b>\nMontant : <b>${ctx.scene.session.buyStore.amount} </b>\nPrix actuel : <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					spanish: `¿Estás seguro/a de querer comprar ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Dirección: <b>${ctx.scene.session.buyStore.buyAddress}</b>\nCantidad: <b>${ctx.scene.session.buyStore.amount} </b>\nPrecio actual: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					arabic: `هل أنت متأكد من رغبتك في شراء ${ctx.scene.session.buyStore.token?.name}؟\n\n<i>العنوان: <b>${ctx.scene.session.buyStore.buyAddress}</b>\nالمبلغ: <b>${ctx.scene.session.buyStore.amount} </b>\nالسعر الحالي: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					chinese: `您确定要购买 ${ctx.scene.session.buyStore.token?.name} 吗？\n\n<i>地址： <b>${ctx.scene.session.buyStore.buyAddress}</b>\n数量： <b>${ctx.scene.session.buyStore.amount} </b>\n当前价格： <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				}[ctx.scene.session.buyStore.language],
				Markup.inlineKeyboard([
					Markup.button.callback(
						{
							english: "Yes, I am sure",
							french: "Oui, je suis sûr(e)",
							spanish: "Sí, estoy seguro/a",
							arabic: "نعم، أنا متأكد",
							chinese: "是的，我确定",
						}[ctx.scene.session.buyStore.language],
						"sendbuy",
					),
					Markup.button.callback(
						{
							english: "Cancel",
							french: "Annuler",
							spanish: "Cancelar",
							arabic: "إلغاء",
							chinese: "取消",
						}[ctx.scene.session.buyStore.language],
						"cancel",
					),
				]),
			);

			ctx.wizard.next();
			return ctx.wizard.next();
		} else {
			await ctx.replyWithHTML(
				{
					english: `What amount(USD) of ${ctx.scene.session.buyStore.token?.name} do you want to buy`,
					french: `Quel montant (USD) de ${ctx.scene.session.buyStore.token?.name} souhaitez-vous acheter`,
					spanish: `¿Qué cantidad (USD) de ${ctx.scene.session.buyStore.token?.name} deseas comprar`,
					arabic: `ما هو المبلغ (بالدولار الأمريكي) من ${ctx.scene.session.buyStore.token?.name} الذي ترغب في شرائه`,
					chinese: `您想购买多少（美元）的 ${ctx.scene.session.buyStore.token?.name}`,
				}[ctx.scene.session.buyStore.language],
				Markup.inlineKeyboard([
					Markup.button.callback(
						{
							english: "Cancel",
							french: "Annuler",
							spanish: "Cancelar",
							arabic: "إلغاء",
							chinese: "取消",
						}[ctx.scene.session.buyStore.language],
						"cancel",
					),
				]),
			);
			return ctx.wizard.next();
		}

		// await ctx.reply("What amount(ETH, USD) of token do you want to buy");
		// console.log("here");
		// ctx.wizard.next();
	},
	stepHandler2,

	stepHandler,
);

stepHandler2.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;
		if (!ctx.from?.id) return;
		const userLanguage = ctx.scene.session.buyStore.language;
		// console.log(text);
		const am = await queryAi(getamountprompt(text));
		if (am.toLowerCase() === "null") {
			// Reply with a warning emoji for invalid input
			await ctx.replyWithHTML(
				{
					english: "Please provide a valid value",
					french: "Veuillez fournir une valeur valide",
					spanish: "Por favor, proporcione un valor válido",
					arabic: "يرجى تقديم قيمة صالحة",
					chinese: "请提供有效值",
				}[userLanguage],
				Markup.inlineKeyboard([
					Markup.button.callback(
						{
							english: "Cancel",
							french: "Annuler",
							spanish: "Cancelar",
							arabic: "إلغاء",
							chinese: "取消",
						}[userLanguage],
						"cancel",
					),
				]),
			);

			return;
		} else {
			ctx.scene.session.buyStore.amount = am;
		}

		const buyAddress = ctx.scene.session.buyStore.buyAddress;
		const token = await processToken(buyAddress);
		if (!token) {
			await ctx.reply(
				{
					english:
						"I couldn't find the token, unsupported chain, or wrong contract address.\n <i> Session exited...</i>",
					french: "Je n'ai pas pu trouver le jeton, chaîne non prise en charge ou mauvaise adresse de contrat.",
					spanish: "No pude encontrar el token, cadena no compatible o dirección de contrato incorrecta.",
					arabic: "لم أتمكن من العثور على الرمز، سلسلة غير مدعومة، أو عنوان العقد خاطئ.",
					chinese: "我找不到代币，不支持的链或错误的合约地址。",
				}[userLanguage],
			);
			return ctx.scene.leave();
		}
		ctx.scene.session.buyStore.token = token.token;

		await ctx.replyWithHTML(
			{
				english: `Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>\nAmount: <b>${ctx.scene.session.buyStore.amount} </b>\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				french: `Êtes-vous sûr de vouloir acheter ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Adresse : <b>${ctx.scene.session.buyStore.buyAddress}</b>\nMontant : <b>${ctx.scene.session.buyStore.amount} </b>\nPrix actuel : <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				spanish: `¿Estás seguro/a de querer comprar ${ctx.scene.session.buyStore.token?.name} ?\n\n<i>Dirección: <b>${ctx.scene.session.buyStore.buyAddress}</b>\nCantidad: <b>${ctx.scene.session.buyStore.amount} </b>\nPrecio actual: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				arabic: `هل أنت متأكد من رغبتك في شراء ${ctx.scene.session.buyStore.token?.name}؟\n\n<i>العنوان: <b>${ctx.scene.session.buyStore.buyAddress}</b>\nالمبلغ: <b>${ctx.scene.session.buyStore.amount} </b>\nالسعر الحالي: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				chinese: `您确定要购买 ${ctx.scene.session.buyStore.token?.name} 吗？\n\n<i>地址： <b>${ctx.scene.session.buyStore.buyAddress}</b>\n数量： <b>${ctx.scene.session.buyStore.amount} </b>\n当前价格： <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
			}[userLanguage],
			Markup.inlineKeyboard([
				Markup.button.callback(
					{
						english: "Yes, I am sure",
						french: "Oui, je suis sûr(e)",
						spanish: "Sí, estoy seguro/a",
						arabic: "نعم، أنا متأكد",
						chinese: "是的，我确定",
					}[userLanguage],
					"sendbuy",
				),
				Markup.button.callback(
					{
						english: "Cancel",
						french: "Annuler",
						spanish: "Cancelar",
						arabic: "إلغاء",
						chinese: "取消",
					}[userLanguage],
					"cancel",
				),
			]),
		);
		return ctx.wizard.next();
	}
});

const executeBuy = async (
	ctx: WizardContext,
	amount: number,
	token: TokenData,
	buyAddress: string,
	userBalance: number,
) => {
	try{
	if (!ctx.from) {
		return await ctx.scene.leave();
	}

	const wallet = await getUserWalletDetails(ctx.from.id);
	const userLanguage = ctx.scene.session.buyStore.language;


	if (userBalance <= amount) {
		ctx.reply(
			{
				english:
					"You have insufficient balance to make this transaction, please try again with a valid amount\n <i> Session exited...</i>",
				french: "Vous n'avez pas assez de solde pour effectuer cette transaction, veuillez réessayer avec un montant valide",
				spanish:
					"No tienes suficiente saldo para realizar esta transacción, por favor inténtalo de nuevo con un monto válido",
				arabic: "لا يوجد لديك رصيد كافٍ لإتمام هذه العملية، يرجى المحاولة مرة أخرى بمبلغ صالح",
				chinese: "您的余额不足以完成此交易，请使用有效金额重试",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}

	if (ctx.scene.session.buyStore.chain?.toLowerCase() !== "solana") throw new Error("")
	// edit this
	//let hash = await buyTokensWithSolana(wallet?.privateKey, buyAddress, amount.toFixed(15));
	if(!wallet?.solPrivateKey) return;
	let hash= await handleSolForToken(wallet?.solPrivateKey,buyAddress, amount)


			if (!hash.success) throw new Error("Transaction failed");

			await ctx.replyWithHTML(
				`You bought ${token.name} \n<i>Amount: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\nTransaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			);

			
			return hash;
		} catch (error: any) {
			
			ctx.reply(
				`An Error occurred please try again later\nError Message: ${
					error.message || "internal server error\n <i> Session exited...</i>"
				}.`,
			);
			return await ctx.scene.leave();
		}

};
