import { fetchOHLCVData } from "./fetchCandlestickData";
import ChartJsImage from "chartjs-to-image";
import { fetchCoin } from "./fetchCoins";
import QuickChart from "quickchart-js";
import { CoinDataType } from "./commands";
export type HistoricalData = {
	address: string;
	h: number;
	o: number;
	l: number;
	c: number;
	type: string;
	v: number;
	unixTime: number;
};
function unixToDateTime(unixTime: number) {
	var milliseconds = unixTime * 1000;

	var dateObject = new Date(milliseconds);

	return dateObject;
}

export const generateTimeAndPriceGraph = async (address: string, timeframe: string, chain: string | undefined) => {
	const startTime = Math.floor((Date.now() - 12 * 24 * 60 * 60 * 1000) / 1000);

	const endTime = Math.floor(Date.now() / 1000);

	const data = await fetchOHLCVData(address, "usd", timeframe, startTime, endTime, chain);
	const coinData = await fetchCoin(address, chain);
	//console.log(coinData)
	if (!data) return null;
	const historicalData = data.items as HistoricalData[];

	//const interval= (historicalData[2].unixTime-historicalData[1].unixTime)

	const last12Items = historicalData.slice(-12);

	const timeAndPrice: TimeandPrice = {
		timeframe: timeframe,
		time: last12Items.map((item) => unixToDateTime(item.unixTime).toLocaleTimeString().slice(0, -3)),
		price: last12Items.map((item: HistoricalData) => item.h),
		timeOfReq: `This chart was created on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
		coinData: coinData,
	};
	//console.log(timeAndPrice);

	const myPriceChart = new QuickChart();
	myPriceChart.setConfig({
		type: "line",
		data: {
			labels: timeAndPrice.time,
			datasets: [
				{
					label: `${timeAndPrice.timeframe} chart`,
					data: timeAndPrice.price,
					borderColor: timeAndPrice.price[0] > timeAndPrice.price[11] ? "red" : "green",
					backgroundColor: "transparent",
				},
			],
		},
	});

//	console.log("here");
	const url = await myPriceChart.getUrl();
	// console.log(url);
	// console.log("here too");
	// const buf = await myPriceChart.toBinary();
	//console.log(await myPriceChart.getUrl());
	//console.log(buf);
	return { timeAndPrice,url };
};

type TimeandPrice = {
	time: string[];
	price: number[];
	timeframe: string;
	timeOfReq: string;
	coinData: TokenData;
};
export interface TokenData {
	address: string;
	decimals: number;
	symbol: string;
	name: string;
	extensions: null | any; // You can replace `any` with a more specific type if necessary
	logoURI: string;
	numberMarkers: number;
	liquidity: number;
	price: number;
	supply: null | any; // You can replace `any` with a more specific type if necessary
	mc: null | any; // You can replace `any` with a more specific type if necessary
	history30mPrice: number;
	priceChange30mPercent: number;
	history1hPrice: number;
	priceChange1hPercent: number;
	history2hPrice: number;
	priceChange2hPercent: number;
	history4hPrice: number;
	priceChange4hPercent: number;
	history6hPrice: number;
	priceChange6hPercent: number;
	history8hPrice: number;
	priceChange8hPercent: number;
	history12hPrice: number;
	priceChange12hPercent: number;
	history24hPrice: number;
	priceChange24hPercent: number;
	uniqueWallet30m: number;
	uniqueWalletHistory30m: number;
	uniqueWallet30mChangePercent: number;
	uniqueWallet1h: number;
	uniqueWalletHistory1h: number;
	uniqueWallet1hChangePercent: number;
	uniqueWallet2h: number;
	uniqueWalletHistory2h: number;
	uniqueWallet2hChangePercent: number;
	uniqueWallet4h: number;
	uniqueWalletHistory4h: number;
	uniqueWallet4hChangePercent: number;
	uniqueWallet6h: number;
	uniqueWalletHistory6h: number;
	uniqueWallet6hChangePercent: number;
	uniqueWallet8h: number;
	uniqueWalletHistory8h: number;
	uniqueWallet8hChangePercent: number;
	uniqueWallet12h: number;
	uniqueWalletHistory12h: number;
	uniqueWallet12hChangePercent: number;
	uniqueWallet24h: number;
	uniqueWalletHistory24h: number;
	uniqueWallet24hChangePercent: number;
	lastTradeUnixTime: number;
	lastTradeHumanTime: string;
	trade30m: number;
	tradeHistory30m: number;
	trade30mChangePercent: number;
	sell30m: number;
	sellHistory30m: number;
	sell30mChangePercent: number;
	buy30m: number;
	buyHistory30m: number;
	buy30mChangePercent: number;
	v30m: number;
	v30mUSD: number;
	vHistory30m: number;
	vHistory30mUSD: number;
	v30mChangePercent: number;
	vBuy30m: number;
	vBuy30mUSD: number;
	vBuyHistory30m: number;
	vBuyHistory30mUSD: number;
	vBuy30mChangePercent: number;
	vSell30m: number;
	vSell30mUSD: number;
	vSellHistory30m: number;
	vSellHistory30mUSD: number;
	vSell30mChangePercent: number;
	trade1h: number;
	tradeHistory1h: number;
	trade1hChangePercent: number;
	sell1h: number;
	sellHistory1h: number;
	sell1hChangePercent: number;
	buy1h: number;
	buyHistory1h: number;
	buy1hChangePercent: number;
	v1h: number;
	v1hUSD: number;
	vHistory1h: number;
	vHistory1hUSD: number;
	v1hChangePercent: number;
	vBuy1h: number;
	vBuy1hUSD: number;
	vBuyHistory1h: number;
	vBuyHistory1hUSD: number;
	vBuy1hChangePercent: number;
	vSell1h: number;
	vSell1hUSD: number;
	vSellHistory1h: number;
	vSellHistory1hUSD: number;
	vSell1hChangePercent: number;
	// Repeat the pattern for other properties
	// ...
	// Add more properties as needed
}
