import { WizardContext } from "@app/functions/telegraf";

import { Composer, Markup, Scenes } from "telegraf";

import { queryAi } from "../queryApi";
import { getamountprompt } from "../prompt";

import {
	addUserHolding,
	addtoCount,
	getUserLanguage,
	getUserWalletDetails,
	sendMessageToAllGroups,
} from "../databases";
import { buyOnBase, buyOnEth } from "../buyfunction";
import type { BigNumber } from "ethers";
import { getEtherBalance } from "../checkBalance";
import { addMillisecondsToDate, delay, getEthPrice, getSolPrice, processToken } from "../helper";
import { TokenData } from "../timePriceData";
import { getSolBalance } from "../checksolbalance";
import { buyTokensWithSolana } from "../solana";

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
};

const stepHandler = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

stepHandler.action("sendbuy", async (ctx) => {
	const { buyAddress, token, time, userBalance } = ctx.scene.session.buyStore;
	let tokenAmount: string;
	let amount = ctx.scene.session.buyStore.amount;
	if (!ctx.from?.id) return;
	const userLanguage = getUserLanguage(ctx.from?.id);
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
		console.log(ethprice);
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
		console.log(tokenAmount);
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
		}[getUserLanguage(ctx.from?.id)],
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

		const wallet = getUserWalletDetails(ctx.from.id);
		const userLanguage = getUserLanguage(ctx.from.id);
		if (!wallet) {
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

		if (chain === "base") {
			ctx.scene.session.buyStore.currency = "ETH";
			const res = await getEtherBalance(wallet?.walletAddress);
			if (!res) {
				await ctx.reply(
					{
						english: "Couldn't get balance, please try again",
						french: "Impossible d'obtenir le solde, veuillez réessayer",
						spanish: "No se pudo obtener el saldo, por favor inténtelo de nuevo",
						arabic: "لم يمكن الحصول على الرصيد، يرجى المحاولة مرة أخرى",
						chinese: "无法获取余额，请重试",
					}[userLanguage],
				);
				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = parseFloat(res.base);
			//userBalance = res?.base;
		} else if (chain === "solana") {
			ctx.scene.session.buyStore.currency = "SOL";
			const solbalance = await getSolBalance(wallet?.solWalletAddress);
			if (!solbalance) {
				await ctx.reply(
					{
						english: "Couldn't get balance, please try again",
						french: "Impossible d'obtenir le solde, veuillez réessayer",
						spanish: "No se pudo obtener el saldo, por favor inténtelo de nuevo",
						arabic: "لم يمكن الحصول على الرصيد، يرجى المحاولة مرة أخرى",
						chinese: "无法获取余额，请重试",
					}[userLanguage],
				);

				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = solbalance;
		} else {
			ctx.scene.session.buyStore.currency = "ETH";
			const res = await getEtherBalance(wallet?.walletAddress);
			if (!res) {
				await ctx.reply(
					{
						english: "Couldn't get balance, please try again",
						french: "Impossible d'obtenir le solde, veuillez réessayer",
						spanish: "No se pudo obtener el saldo, por favor inténtelo de nuevo",
						arabic: "لم يمكن الحصول على الرصيد، يرجى المحاولة مرة أخرى",
						chinese: "无法获取余额，请重试",
					}[userLanguage],
				);
				return ctx.scene.leave();
			}
			ctx.scene.session.buyStore.userBalance = parseFloat(res.eth);
		}

		//const ethprice = await getEthPrice();
		if (!ctx.scene.session.buyStore.userBalance) {
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
		//const userBalanceInUsd = userBalance * parseFloat(ethprice);

		if (ctx.scene.session.buyStore.amount) {
			await ctx.replyWithHTML(
				{
					english: `Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\\n\\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nAmount: <b>${ctx.scene.session.buyStore.amount} </b>\\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					french: `Êtes-vous sûr de vouloir acheter ${ctx.scene.session.buyStore.token?.name} ?\\n\\n<i>Adresse : <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nMontant : <b>${ctx.scene.session.buyStore.amount} </b>\\nPrix actuel : <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					spanish: `¿Estás seguro/a de querer comprar ${ctx.scene.session.buyStore.token?.name} ?\\n\\n<i>Dirección: <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nCantidad: <b>${ctx.scene.session.buyStore.amount} </b>\\nPrecio actual: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					arabic: `هل أنت متأكد من رغبتك في شراء ${ctx.scene.session.buyStore.token?.name}؟\\n\\n<i>العنوان: <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nالمبلغ: <b>${ctx.scene.session.buyStore.amount} </b>\\nالسعر الحالي: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
					chinese: `您确定要购买 ${ctx.scene.session.buyStore.token?.name} 吗？\\n\\n<i>地址： <b>${ctx.scene.session.buyStore.buyAddress}</b>\\n数量： <b>${ctx.scene.session.buyStore.amount} </b>\\n当前价格： <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
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
		const userLanguage = getUserLanguage(ctx.from?.id);
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
					english: "I couldn't find the token, unsupported chain, or wrong contract address.",
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
				english: `Are you sure you want to buy ${ctx.scene.session.buyStore.token?.name} ?\\n\\n<i>Address: <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nAmount: <b>${ctx.scene.session.buyStore.amount} </b>\\nCurrent Price: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				french: `Êtes-vous sûr de vouloir acheter ${ctx.scene.session.buyStore.token?.name} ?\\n\\n<i>Adresse : <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nMontant : <b>${ctx.scene.session.buyStore.amount} </b>\\nPrix actuel : <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				spanish: `¿Estás seguro/a de querer comprar ${ctx.scene.session.buyStore.token?.name} ?\\n\\n<i>Dirección: <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nCantidad: <b>${ctx.scene.session.buyStore.amount} </b>\\nPrecio actual: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				arabic: `هل أنت متأكد من رغبتك في شراء ${ctx.scene.session.buyStore.token?.name}؟\\n\\n<i>العنوان: <b>${ctx.scene.session.buyStore.buyAddress}</b>\\nالمبلغ: <b>${ctx.scene.session.buyStore.amount} </b>\\nالسعر الحالي: <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
				chinese: `您确定要购买 ${ctx.scene.session.buyStore.token?.name} 吗？\\n\\n<i>地址： <b>${ctx.scene.session.buyStore.buyAddress}</b>\\n数量： <b>${ctx.scene.session.buyStore.amount} </b>\\n当前价格： <b>${ctx.scene.session.buyStore.token?.price}</b></i>`,
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
	if (!ctx.from) {
		return await ctx.scene.leave();
	}

	const wallet = getUserWalletDetails(ctx.from.id);
	const userLanguage = getUserLanguage(ctx.from.id);
	//let userBalance=ctx.scene.session.buyStore.userBalance;

	if (userBalance <= amount) {
		ctx.reply(
			{
				english: "You have insufficient balance to make this transaction, please try again with a valid amount",
				french: "Vous n'avez pas assez de solde pour effectuer cette transaction, veuillez réessayer avec un montant valide",
				spanish:
					"No tienes suficiente saldo para realizar esta transacción, por favor inténtalo de nuevo con un monto válido",
				arabic: "لا يوجد لديك رصيد كافٍ لإتمام هذه العملية، يرجى المحاولة مرة أخرى بمبلغ صالح",
				chinese: "您的余额不足以完成此交易，请使用有效金额重试",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}
	// edit this
	let hash;
	// Use buy function here
	if (ctx.scene.session.buyStore.chain?.toLowerCase() === "ethereum") {
		try {
			//	console.log(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());

			hash = await buyOnEth(wallet?.privateKey, buyAddress, amount.toFixed(15).toString());
			if (!hash)
				throw new Error(
					{
						english: "Transaction failed/expired",
						french: "Transaction échouée/expirée",
						spanish: "Transacción fallida/caducada",
						arabic: "فشلت العملية / انتهت الصلاحية",
						chinese: "交易失败/已过期",
					}[userLanguage],
				);
			await ctx.replyWithHTML(
				{
					english: `You bought ${token.name} \n<i>Amount: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\nTransaction hash:<a href= "https://etherscan.io/tx/${hash}">${hash}</a>`,
					french: `Vous avez acheté ${token.name} \n<i>Montant : <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Adresse du contrat : <b>${buyAddress}</b></i>\nHash de transaction : <a href= "https://etherscan.io/tx/${hash}">${hash}</a>`,
					spanish: `Has comprado ${token.name} \n<i>Cantidad: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Dirección del contrato: <b>${buyAddress}</b></i>\nHash de transacción: <a href= "https://etherscan.io/tx/${hash}">${hash}</a>`,
					arabic: `لقد اشتريت ${token.name} \n<i>المبلغ: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>عنوان العقد: <b>${buyAddress}</b></i>\nهاش المعاملة: <a href= "https://etherscan.io/tx/${hash}">${hash}</a>`,
					chinese: `您购买了 ${token.name} \n<i>数量: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>合约地址: <b>${buyAddress}</b></i>\n交易哈希: <a href= "https://etherscan.io/tx/${hash}">${hash}</a>`,
				}[userLanguage],
			);

			// await sendMessageToAllGroups(
			// 	`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
			// );
			if (hash) {
				addUserHolding(ctx.from?.id, buyAddress, "ethereum");
				addtoCount();
			}
			return hash;
		} catch (error: any) {
			ctx.reply(
				{
					english: `An Error occurred please try again later\nError Message: ${error.message}.`,
					french: `Une erreur est survenue, veuillez réessayer plus tard\nMessage d'erreur : ${error.message}.`,
					spanish: `Se ha producido un error, por favor inténtelo de nuevo más tarde\nMensaje de error: ${error.message}.`,
					arabic: `حدث خطأ، يرجى المحاولة مرة أخرى في وقت لاحق\nرسالة الخطأ: ${error.message}.`,
					chinese: `发生错误，请稍后重试\n错误信息: ${error.message}.`,
				}[userLanguage],
			);
			return await ctx.scene.leave();
		}
	}

	// console.log(amountinEth);

	if (ctx.scene.session.buyStore.chain?.toLowerCase() === "solana") {
		try {
			throw new Error(
				{
					english: "Due to the congestion on the SOL ecosystem, Spl token trades are temporarily unavailable",
					french: "En raison de la congestion sur l'écosystème SOL, les échanges de jetons Spl ne sont temporairement pas disponibles",
					spanish:
						"Debido a la congestión en el ecosistema SOL, los intercambios de tokens Spl no están disponibles temporalmente",
					arabic: "نظرًا للازدحام في نظام SOL، فإن تداول رموز Spl غير متاح مؤقتًا",
					chinese: "由于SOL生态系统拥堵，Spl代币交易暂时不可用",
				}[userLanguage],
			);
			hash = await buyTokensWithSolana(wallet?.privateKey, buyAddress, amount.toFixed(15));
			if (!hash) throw new Error("Transaction failed/expired due to network congestion");

			await ctx.replyWithHTML(
				`You bought ${token.name} \n<i>Amount: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\nTransaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			);

			// await sendMessageToAllGroups(
			// 	`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			// );

			// if (hash) {
			// 	addUserHolding(ctx.from?.id, buyAddress, "solana");
			// }
			return hash;
		} catch (error: any) {
			//await delay(5000);
			ctx.reply(
				{
					english: "An Error occurred please try again later\nError Message: ${error.message}.",
					french: "Une erreur est survenue, veuillez réessayer plus tard\nMessage d'erreur : ${error.message}.",
					spanish:
						"Se ha producido un error, por favor inténtelo de nuevo más tarde\nMensaje de error: ${error.message}.",
					arabic: "حدث خطأ، يرجى المحاولة مرة أخرى في وقت لاحق\nرسالة الخطأ: ${error.message}.",
					chinese: "发生错误，请稍后重试\n错误信息: ${error.message}.",
				}[userLanguage],
			);
			return await ctx.scene.leave();
		}
	}
	try {
		//	console.log(wallet?.privateKey, buyAddress, amountinEth.toFixed(15).toString());

		hash = await buyOnBase(wallet?.privateKey, buyAddress, amount.toFixed(15).toString());
		if (!hash) throw new Error("Transaction failed/expired");
	} catch (error: any) {
		ctx.reply(
			{
				english: `An Error occurred please try again later\nError Message: ${error.message}.`,
				french: `Une erreur est survenue, veuillez réessayer plus tard\nMessage d'erreur : ${error.message}.`,
				spanish: `Se ha producido un error, por favor inténtelo de nuevo más tarde\nMensaje de error: ${error.message}.`,
				arabic: `حدث خطأ، يرجى المحاولة مرة أخرى في وقت لاحق\nرسالة الخطأ: ${error.message}.`,
				chinese: `发生错误，请稍后重试\n错误信息: ${error.message}.`,
			}[userLanguage],
		);

		return await ctx.scene.leave();
	}

	await ctx.replyWithHTML(
		{
			english: `You bought ${token.name} \n<i>Amount: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Contract Address: <b>${buyAddress}</b></i>\nTransaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
			french: `Vous avez acheté ${token.name} \n<i>Montant : <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Adresse du contrat : <b>${buyAddress}</b></i>\nHash de transaction : <a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
			spanish: `Has comprado ${token.name} \n<i>Cantidad: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>Dirección del contrato: <b>${buyAddress}</b></i>\nHash de transacción: <a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
			arabic: `لقد اشتريت ${token.name} \n<i>المبلغ: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>عنوان العقد: <b>${buyAddress}</b></i>\nهاش المعاملة: <a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
			chinese: `您购买了 ${token.name} \n<i>数量: <b>${amount} ${ctx.scene.session.buyStore.currency}</b></i>\n<i>合约地址: <b>${buyAddress}</b></i>\n交易哈希: <a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
		}[userLanguage],
	);

	// await sendMessageToAllGroups(
	// 	`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
	// );
	if (hash) {
		addUserHolding(ctx.from?.id, buyAddress, "base");
	}
	addtoCount();
	return hash;
};
