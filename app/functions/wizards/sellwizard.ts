import { WizardContext } from "@app/functions/telegraf";

import { Composer, Context, Markup, Scenes } from "telegraf";

import { queryAi } from "../queryApi";
import { getsellamountprompt } from "../prompt";

import { getEtherBalance, getTokenBalance } from "../checkBalance";
import { addMillisecondsToDate, getEthPrice, processToken } from "../helper";
import { sell, sellOnEth } from "../sellfunction";

import { TokenData } from "../timePriceData";
import { getParticularSolTokenBalance } from "../checksolbalance";
import { sellTokensWithSolana } from "../solana";
import { getUserLanguage, getUserWalletDetails, removeUserHolding } from "../AWSusers";
import { addtoCount } from "../databases";
import { updateTransaction } from "../awslogs";

const initialData = {
	sellAddress: null,
	amount: null,
	currency: null,
	token: null,
	time: undefined,
	userBalance: null,
	language: "",
};

const stepHandler = new Composer<WizardContext>();
const stepHandler2 = new Composer<WizardContext>();

export const sellWizard = new Scenes.WizardScene<WizardContext>(
	"sell-wizard",
	async (ctx) => {
		if (!ctx.from?.id) return;
		const userLanguage = await getUserLanguage(ctx.from?.id);

		const wallet = await getUserWalletDetails(ctx.from.id);
		if (!wallet) {
			await ctx.reply(
				{
					english: `You do not have an attached wallet, send a direct message with /wallet to initialise it\n <i> Session exited...</i>`,
					french: `Vous n'avez pas de portefeuille attaché, envoyez un message direct avec /wallet pour l'initialiser`,
					spanish: `No tienes un monedero adjunto, envía un mensaje directo con /wallet para iniciarlo`,
					arabic: `ليس لديك محفظة مرفقة، أرسل رسالة مباشرة مع /wallet لتهيئتها`,
					chinese: ` 您没有附加的钱包，请发送私信并使用 /wallet 来初始化它`,
				}[userLanguage],
			);
			return ctx.scene.leave();
		}
		ctx.scene.session.sellStore = JSON.parse(JSON.stringify(initialData));

		ctx.scene.session.sellStore.language = userLanguage;

		//@ts-ignore
		ctx.scene.session.sellStore.sellAddress = ctx.scene.state.address;
		//@ts-ignore
		ctx.scene.session.sellStore.token = ctx.scene.state.token.token;
		//@ts-ignore
		ctx.scene.session.sellStore.time = ctx.scene.state.time;
		// @ts-ignore
		ctx.scene.session.sellStore.amount = ctx.scene.state.amount;
		//@ts-ignore
		ctx.scene.session.sellStore.chain = ctx.scene.state.token.chain;

		const chain = ctx.scene.session.sellStore.chain;

		if (chain?.toLowerCase() !== "ethereum" && chain?.toLowerCase() !== "base") {
			await ctx.reply(
				{
					english:
						"We currently only support trading on Ethereum for now. Please bear with us as we are working on supporting other tokens.\n <i> Session exited...</i>",
					french: "Nous prenons actuellement uniquement en charge les échanges sur Ethereum, Binance Smart Chain et Solana pour le moment. Veuillez patienter pendant que nous travaillons à prendre en charge d'autres jetons.",
					spanish:
						"Actualmente solo admitimos operaciones de trading en Ethereum, Binance Smart Chain y Solana. Por favor, tenga paciencia mientras trabajamos en admitir otros tokens.",
					arabic: "نحن ندعم حاليًا التداول فقط على Ethereum و Binance Smart Chain و Solana في الوقت الحالي. يرجى التحلي بالصبر بينما نعمل على دعم رموز أخرى.",
					chinese:
						"目前我们只支持在以太坊、币安智能链和Solana上交易。请您耐心等待，我们正在努力支持其他代币。",
				}[userLanguage],
			);
			return ctx.scene.leave();
		}

		if (!ctx.from?.id || !ctx.scene.session.sellStore.token || !ctx.scene.session.sellStore.sellAddress) {
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

		if (ctx.scene.session.sellStore.amount) {
			await ctx.replyWithHTML(
				{
					english: `Are you sure you want to sell ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.sellStore.sellAddress}</b>\nAmount: <b>${ctx.scene.session.sellStore.amount} %</b>\nCurrent Price: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
					french: `Êtes-vous sûr de vouloir vendre ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Adresse : <b>${ctx.scene.session.sellStore.sellAddress}</b>\nMontant : <b>${ctx.scene.session.sellStore.amount} %</b>\nPrix actuel : <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
					spanish: `¿Estás seguro/a de querer vender ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Dirección: <b>${ctx.scene.session.sellStore.sellAddress}</b>\nCantidad: <b>${ctx.scene.session.sellStore.amount} %</b>\nPrecio actual: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
					arabic: `هل أنت متأكد من رغبتك في بيع ${ctx.scene.session.sellStore.token?.name} ؟\n\n<i>العنوان: <b>${ctx.scene.session.sellStore.sellAddress}</b>\nالمبلغ: <b>${ctx.scene.session.sellStore.amount} %</b>\nالسعر الحالي: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
					chinese: `您确定要出售 ${ctx.scene.session.sellStore.token?.name} 吗？\n\n<i>地址： <b>${ctx.scene.session.sellStore.sellAddress}</b>\n数量： <b>${ctx.scene.session.sellStore.amount} %</b>\n当前价格： <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
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
						"sendsell",
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
					english: `What percentage of ${ctx.scene.session.sellStore.token?.name} do you want to sell`,
					french: `Quel pourcentage de ${ctx.scene.session.sellStore.token?.name} souhaitez-vous vendre`,
					spanish: `¿Qué porcentaje de ${ctx.scene.session.sellStore.token?.name} quieres vender`,
					arabic: `ما هي نسبة ${ctx.scene.session.sellStore.token?.name} التي ترغب في بيعها`,
					chinese: `您想出售${ctx.scene.session.sellStore.token?.name}的百分之多少`,
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
	},
	stepHandler2,

	stepHandler,
);

stepHandler2.on("text", async (ctx) => {
	if (ctx.message && "text" in ctx.message) {
		const { text } = ctx.message;
		if (!ctx.from?.id) return;
		const userLanguage = ctx.scene.session.sellStore.language;
		const am = await queryAi(getsellamountprompt(text));
		if (am.toLowerCase() === "null") {
			await ctx.replyWithHTML(
				{
					english: "Please provide a valid value.",
					french: "Veuillez fournir une valeur valide.",
					spanish: "Por favor, proporcione un valor válido.",
					arabic: "يرجى تقديم قيمة صالحة.",
					chinese: "请提供有效值。",
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
			ctx.scene.session.sellStore.amount = am;
		}

		//const amount = ctx.scene.session.sellStore.amount;
		const sellAddress = ctx.scene.session.sellStore.sellAddress;

		const token = await processToken(sellAddress);
		if (!token) {
			ctx.reply(
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
		ctx.scene.session.sellStore.token = token.token;

		await ctx.replyWithHTML(
			{
				english: `Are you sure you want to sell ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Address: <b>${ctx.scene.session.sellStore.sellAddress}</b>\nAmount: <b>${ctx.scene.session.sellStore.amount} %</b>\nCurrent Price: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
				french: `Êtes-vous sûr de vouloir vendre ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Adresse : <b>${ctx.scene.session.sellStore.sellAddress}</b>\nMontant : <b>${ctx.scene.session.sellStore.amount} %</b>\nPrix actuel : <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
				spanish: `¿Estás seguro/a de querer vender ${ctx.scene.session.sellStore.token?.name} ?\n\n<i>Dirección: <b>${ctx.scene.session.sellStore.sellAddress}</b>\nCantidad: <b>${ctx.scene.session.sellStore.amount} %</b>\nPrecio actual: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
				arabic: `هل أنت متأكد من رغبتك في بيع ${ctx.scene.session.sellStore.token?.name} ؟\n\n<i>العنوان: <b>${ctx.scene.session.sellStore.sellAddress}</b>\nالمبلغ: <b>${ctx.scene.session.sellStore.amount} %</b>\nالسعر الحالي: <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
				chinese: `您确定要出售 ${ctx.scene.session.sellStore.token?.name} 吗？\n\n<i>地址： <b>${ctx.scene.session.sellStore.sellAddress}</b>\n数量： <b>${ctx.scene.session.sellStore.amount} %</b>\n当前价格： <b>${ctx.scene.session.sellStore.token?.price}</b></i>`,
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
					"sendsell",
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
stepHandler.action("sendsell", async (ctx) => {
	const { sellAddress, amount, token, time } = ctx.scene.session.sellStore;
	if (!ctx.from?.id) return;
	const userLanguage = ctx.scene.session.sellStore.language;
	if (!sellAddress || !amount || !token) {
		ctx.reply(
			{
				english: "An error occurred, please try again\n <i> Session exited...</i>",
				french: "Une erreur s'est produite, veuillez réessayer",
				spanish: "Se ha producido un error, por favor inténtalo de nuevo",
				arabic: "حدث خطأ، يرجى المحاولة مرة أخرى",
				chinese: "发生错误，请重试",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}

	if (time) {
		if (parseFloat(time) > 86400000) {
			ctx.reply(
				{
					english: "Error: Maximum interval is 24 hours\n <i> Session exited...</i>",
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
				english: `Sell has been scheduled for ${date.toTimeString()}`,
				french: `La vente a été programmée pour ${date.toTimeString()}`,
				spanish: `La venta está programada para ${date.toTimeString()}`,
				arabic: `تم جدولة البيع لـ ${date.toTimeString()}`,
				chinese: `出售已安排在 ${date.toTimeString()}`,
			}[userLanguage],
		);
		//await delay(parseFloat(time));
		setTimeout(async () => {
			try {
				await executeSell(ctx, amount, token, sellAddress);
			} catch (error) {
				console.log(error);
				ctx.reply(
					{
						english: "An error occurred, please try again\n <i> Session exited...</i>",
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
				english: `Selling ${ctx.scene.session.sellStore.token?.name} ...`,
				french: `Vente de ${ctx.scene.session.sellStore.token?.name} ...`,
				spanish: `Vendiendo ${ctx.scene.session.sellStore.token?.name} ...`,
				arabic: `جاري بيع ${ctx.scene.session.sellStore.token?.name} ...`,
				chinese: `出售 ${ctx.scene.session.sellStore.token?.name} ...`,
			}[userLanguage],
		);

		try {
			await executeSell(ctx, amount, token, sellAddress);
		} catch (error) {
			console.log(error);
			ctx.reply(
				{
					english: "An error occurred, please try again\n <i> Session exited...</i>",
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
		}[ctx.scene.session.sellStore.language],
	);

	return await ctx.scene.leave();
};
stepHandler.action("cancel", cancelfn);
stepHandler2.action("cancel", cancelfn);

const executeSell = async (
	ctx: WizardContext,

	amount: string,
	token: TokenData,
	sellAddress: string,
) => {
	//if (!ctx.from) return await ctx.replyWithHTML("<b>Transaction failed</b>");
	if (!ctx.from?.id) return;

	const userLanguage = ctx.scene.session.sellStore.language;
	const wallet = await getUserWalletDetails(ctx.from.id);
	const tokenData = await processToken(sellAddress);
	const ethprice = (await getEthPrice()) as number;
	const userEthBalance = await getEtherBalance(wallet?.walletAddress);
	if (!userEthBalance) {
		await ctx.reply(
			{
				english: "Couldn't get balance, please try again\n <i> Session exited...</i>",
				french: "Impossible d'obtenir le solde, veuillez réessayer",
				spanish: "No se pudo obtener el saldo, por favor inténtelo de nuevo",
				arabic: "لم يمكن الحصول على الرصيد، يرجى المحاولة مرة أخرى",
				chinese: "无法获取余额，请重试",
			}[ctx.scene.session.sellStore.language],
		);

		return ctx.scene.leave();
	}

	if (!tokenData) {
		ctx.reply(
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

	if (tokenData.chain === "base") {
		ctx.scene.session.sellStore.currency = "ETH";
		//const res = await getEtherBalance(wallet?.walletAddress);
		const tokensBalance = await getTokenBalance(wallet?.walletAddress, token.address, "base");
		if (!tokensBalance) {
			await ctx.reply(
				{
					english: "Couldn't get balance, please try again\n <i> Session exited...</i>",
					french: "Impossible d'obtenir le solde, veuillez réessayer",
					spanish: "No se pudo obtener el saldo, por favor inténtelo de nuevo",
					arabic: "لم يمكن الحصول على الرصيد، يرجى المحاولة مرة أخرى",
					chinese: "无法获取余额，请重试",
				}[userLanguage],
			);
			return ctx.scene.leave();
		}

		//continue hereee/ trying to get the amount
		ctx.scene.session.sellStore.userBalance = tokensBalance;
		//userBalance = res?.base;
	} else if (tokenData.chain === "solana") {
		ctx.scene.session.sellStore.currency = "SOL";
		const solbalance = await getParticularSolTokenBalance(sellAddress, wallet?.solWalletAddress);
		if (!solbalance || solbalance.length === 0) {
			await ctx.reply(
				{
					english: "Couldn't get balance, please try again\n <i> Session exited...</i>",
					french: "Impossible d'obtenir le solde, veuillez réessayer",
					spanish: "No se pudo obtener el saldo, por favor inténtelo de nuevo",
					arabic: "لم يمكن الحصول على الرصيد، يرجى المحاولة مرة أخرى",
					chinese: "无法获取余额，请重试",
				}[userLanguage],
			);

			return ctx.scene.leave();
		}
		ctx.scene.session.sellStore.userBalance = solbalance[0].tokenBalance;
	} else if (tokenData.chain === "ethereum") {
		ctx.scene.session.sellStore.currency = "ETH";
		const tokensBalance = await getTokenBalance(wallet?.walletAddress, token.address, "ethereum");
		if (!tokensBalance) {
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
		ctx.scene.session.sellStore.userBalance = tokensBalance;
	} else {
		await ctx.reply(
			{
				english: "Only Trading on Base and Ethereum are supported at this time\n <i> Session exited...</i>",
				french: "Seuls les échanges sur Solana, Base et Ethereum sont pris en charge pour le moment",
				spanish: "Solo se admiten transacciones en Solana, Base y Ethereum en este momento",
				arabic: "يتم دعم التداول فقط على Solana و Base و Ethereum في الوقت الحالي",
				chinese: "目前仅支持在Solana、Base和Ethereum上交易",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}

	if (!ctx.scene.session.sellStore.userBalance) {
		await ctx.reply(
			{
				english: "Couldn't get balance, please try again\n <i> Session exited...</i>",
				french: "Impossible d'obtenir le solde, veuillez réessayer",
				spanish: "No se pudo obtener el saldo, por favor inténtelo de nuevo",
				arabic: "لم يمكن الحصول على الرصيد، يرجى المحاولة مرة أخرى",
				chinese: "无法获取余额，请重试",
			}[userLanguage],
		);
		return ctx.scene.leave();
	}

	const amountintokens = (parseFloat(amount) / 100) * ctx.scene.session.sellStore.userBalance;

	if (amountintokens > ctx.scene.session.sellStore.userBalance) {
		ctx.replyWithHTML(
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

	let hash;
	if (ctx.scene.session.sellStore.chain?.toLowerCase() === "ethereum") {
		try {
			hash = await sellOnEth(
				wallet?.privateKey,
				token.address,
				amountintokens.toFixed(2).toString(),
				tokenData.token.decimals,
				parseFloat(userEthBalance?.eth),
			);

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
					english: `You sold ${token?.name} \n<i>Amount: <b>${amountintokens} ${token.symbol}</b></i>\n<i>Contract Address: <b>${sellAddress}</b></i>\nTransaction hash: <a href="https://etherscan.io/tx/${hash}">${hash}</a>`,
					french: `Vous avez vendu ${token?.name} \n<i>Montant : <b>${amountintokens} ${token.symbol}</b></i>\n<i>Adresse du contrat : <b>${sellAddress}</b></i>\nHash de transaction : <a href="https://etherscan.io/tx/${hash}">${hash}</a>`,
					spanish: `Has vendido ${token?.name} \n<i>Cantidad: <b>${amountintokens} ${token.symbol}</b></i>\n<i>Dirección del contrato: <b>${sellAddress}</b></i>\nHash de transacción: <a href="https://etherscan.io/tx/${hash}">${hash}</a>`,
					arabic: `لقد قمت ببيع ${token?.name} \n<i>المبلغ: <b>${amountintokens} ${token.symbol}</b></i>\n<i>عنوان العقد: <b>${sellAddress}</b></i>\nمعرف المعاملة: <a href="https://etherscan.io/tx/${hash}">${hash}</a>`,
					chinese: `您已出售 ${token?.name} \n<i>数量： <b>${amountintokens} ${token.symbol}</b></i>\n<i>合约地址： <b>${sellAddress}</b></i>\n交易哈希： <a href="https://etherscan.io/tx/${hash}">${hash}</a>`,
				}[userLanguage],
			);
			const balance = await getTokenBalance(wallet?.walletAddress, sellAddress);
			if (balance <= 0 && hash) await removeUserHolding(ctx.from?.id, sellAddress, "ethereum");

			await updateTransaction((amountintokens * token.price) / ethprice);

			addtoCount();
			//ctx.scene.leave();
			return hash;
		} catch (error: any) {
			ctx.reply(
				{
					english: `An Error occurred please try again later\nError Message: ${
						error.message || "internal server error\n <i> Session exited...</i>"
					}.`,
					french: `Une erreur est survenue, veuillez réessayer plus tard\nMessage d'erreur : ${
						error.message || "Erreur interne du serveur"
					}.`,
					spanish: `Se ha producido un error, por favor inténtelo de nuevo más tarde\nMensaje de error: ${
						error.message || "Error interno del servidor"
					}.`,
					arabic: `حدث خطأ، يرجى المحاولة مرة أخرى في وقت لاحق\nرسالة الخطأ: ${
						error.message || "خطأ داخلي في الخادم"
					}.`,
					chinese: `发生错误，请稍后重试\n错误信息: ${error.message || "服务器内部错误"}.`,
				}[userLanguage],
			);
			return ctx.scene.leave();
		}
	}

	if (ctx.scene.session.sellStore.chain?.toLowerCase() === "solana") {
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
			hash = await sellTokensWithSolana(
				wallet?.solPrivateKey,
				sellAddress,
				amountintokens.toFixed(15),
				token.decimals,
			);

			if (!hash) throw new Error("Transaction failed/expired");

			await ctx.replyWithHTML(
				`You sold ${token.name} \n<i>Amount: <b>${amountintokens} ${token.symbol}</b></i>\n<i>Contract Address: <b>${sellAddress}</b></i>\nTransaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			);

			// await sendMessageToAllGroups(
			// 	`Successful transaction made through @nova_trader_bot.\n Transaction hash:<a href= "https://solscan.io/tx/${hash}">${hash}</a>`,
			// );

			// if (hash) {
			// 	addUserHolding(ctx.from?.id, buyAddress, "solana");
			// }
			//ctx.scene.leave();
			return hash;
		} catch (error: any) {
			//await delay(5000);
			ctx.reply(
				{
					english: `An Error occurred please try again later\nError Message: ${
						error.message || "internal server error\n <i> Session exited...</i>"
					}.`,
					french: `Une erreur est survenue, veuillez réessayer plus tard\nMessage d'erreur : ${
						error.message || "Erreur interne du serveur"
					}.`,
					spanish: `Se ha producido un error, por favor inténtelo de nuevo más tarde\nMensaje de error: ${
						error.message || "Error interno del servidor"
					}.`,
					arabic: `حدث خطأ، يرجى المحاولة مرة أخرى في وقت لاحق\nرسالة الخطأ: ${
						error.message || "خطأ داخلي في الخادم"
					}.`,
					chinese: `发生错误，请稍后重试\n错误信息: ${error.message || "服务器内部错误"}.`,
				}[userLanguage],
			);
			return await ctx.scene.leave();
		}
	}
	//console.log(wallet?.privateKey, token.address, amountintokens, token.decimals);

	try {
		hash = await sell(
			wallet?.privateKey,
			token.address,
			amountintokens.toFixed(2).toString(),
			token.decimals,
			parseFloat(userEthBalance?.base),
		);
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
	} catch (error: any) {
		ctx.reply(
			{
				english: `An Error occurred please try again later\nError Message: ${
					error.message || "internal server error\n <i> Session exited...</i>"
				}.`,
				french: `Une erreur est survenue, veuillez réessayer plus tard\nMessage d'erreur : ${
					error.message || "Erreur interne du serveur"
				}.`,
				spanish: `Se ha producido un error, por favor inténtelo de nuevo más tarde\nMensaje de error: ${
					error.message || "Error interno del servidor"
				}.`,
				arabic: `حدث خطأ، يرجى المحاولة مرة أخرى في وقت لاحق\nرسالة الخطأ: ${
					error.message || "خطأ داخلي في الخادم"
				}.`,
				chinese: `发生错误，请稍后重试\n错误信息: ${error.message || "服务器内部错误"}.`,
			}[userLanguage],
		);
		return ctx.scene.leave();
	}

	await ctx.replyWithHTML(
		{
			english: `You sold ${token?.name} \n<i>Amount: <b>${amountintokens} ${token.symbol}</b></i>\n<i>Contract Address: <b>${sellAddress}</b></i>\nTransaction hash: <a href="https://basescan.org/tx/${hash}">${hash}</a>`,
			french: `Vous avez vendu ${token?.name} \n<i>Montant : <b>${amountintokens} ${token.symbol}</b></i>\n<i>Adresse de contrat : <b>${sellAddress}</b></i>\nHash de transaction : <a href="https://basescan.org/tx/${hash}">${hash}</a>`,
			spanish: `Has vendido ${token?.name} \n<i>Cantidad: <b>${amountintokens} ${token.symbol}</b></i>\n<i>Dirección del contrato: <b>${sellAddress}</b></i>\nHash de transacción: <a href="https://basescan.org/tx/${hash}">${hash}</a>`,
			arabic: `لقد قمت ببيع ${token?.name} \n<i>المبلغ: <b>${amountintokens} ${token.symbol}</b></i>\n<i>عنوان العقد: <b>${sellAddress}</b></i>\nمعرف المعاملة: <a href="https://basescan.org/tx/${hash}">${hash}</a>`,
			chinese: `您已出售 ${token?.name} \n<i>数量： <b>${amountintokens} ${token.symbol}</b></i>\n<i>合约地址： <b>${sellAddress}</b></i>\n交易哈希： <a href="https://basescan.org/tx/${hash}">${hash}</a>`,
		}[userLanguage],
	);

	const balance = await getTokenBalance(wallet?.walletAddress, sellAddress);
	if (balance <= 0 && hash) removeUserHolding(ctx.from?.id, sellAddress, "base");

	await updateTransaction((amountintokens * token.price) / ethprice);
	// await sendMessageToAllGroups(
	// 	`Succssful transaction made throught @NOVA bot.\n Transaction hash:<a href= "https://basescan.org/tx/${hash}">${hash}</a>`,
	// );
	//ctx.scene.leave();
	return hash;
};
