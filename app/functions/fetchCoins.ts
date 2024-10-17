import { Context } from "telegraf";
import { CoinDataType, Data } from "./commands";
import axios, { AxiosResponse } from "axios";

import { TokenData } from "./timePriceData";

interface DexScreenerPair {
	chain: string;
	address: string;
	dexUrl: string;
	name: string;
	symbol: string;
	price: string;
	mcap: number;
	liquidity: number;
}
const supportedChains = ["solana", "ton", "bsc", "ethereum", "base"];
export async function fetchOHLCVData(
	address: string,
	currency: string,
	type: string,
	timeFrom: number,
	timeTo: number,
	chain: string | undefined,
) {
	const url = `https://multichain-api.birdeye.so/${chain}/amm/ohlcv`;
	const params = {
		address: address,
		currency: currency,
		type: type,
		time_from: timeFrom,
		time_to: timeTo,
	};

	const headers = {
		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
		Accept: "application/json, text/plain, /",
		"Accept-Language": "en-US,en;q=0.5",
		"Accept-Encoding": "gzip, deflate, br",
		"agent-id": "f28a43fd-ca0e-4dad-a4ea-b28f8f3805b5",
		"cf-be":
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDI5OTAzMzAsImV4cCI6MTcwMjk5MDYzMH0.E0-mp3KcBGB2k_CivhRFIoSkecfVL14scWJOXZxVC_g",
		Origin: "https://birdeye.so",
		Connection: "keep-alive",
		Referer: "https://birdeye.so/",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-site",
		TE: "trailers",
		"Content-Type": "application/json",
	};

	try {
		const response = await axios.get(url, {
			params: params,
			headers: headers,
			responseType: "json",
			timeout: 10000,
		});

		return response.data.data;
	} catch (error) {
		console.error("Error fetching data:", error);
		return null;
	}
}

// Example usage:

// const fetchData = async (network: string): Promise<{ data: CoinDataType[] }> => {
// 	const url = `https://multichain-api.birdeye.so/${network}/trending/token?u=da39a3ee5e6b4b0d3255bfef95601890afd80709`;

// 	const headers = {
// 		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
// 		//Accept: "application/json, text/plain, /",
// 		"Accept-Language": "en-US,en;q=0.5",
// 		token: "undefined",
// 		"agent-id": "f28a43fd-cb0e-4dad-a4eb-b28e8f3805b5",
// 		Origin: "https://birdeye.so",
// 		Referer: "https://birdeye.so/",
// 		"Sec-Fetch-Dest": "empty",
// 		"Sec-Fetch-Mode": "cors",
// 	};

// 	try {
// 		const response: AxiosResponse<{ data: CoinDataType[] }> = await axios.get(url, { headers });
// 		//console.log(response);
// 		let result = response.data;

// 		return result;
// 	} catch (error) {
// 		console.error("Error:", error);
// 		throw error; // Rethrow the error for the caller to handle
// 	}
// };

const fetchData = async (chain: string) => {
	try {
		const response = await axios.get("https://public-api.birdeye.so/defi/token_trending", {
			params: {
				limit: 10,
			},
			headers: {
				"X-API-KEY": process.env.BIRDEYE_KEY,
				"x-chain": chain,
			},
		});
		return response.data.data as Data;
	} catch (error) {
		console.error("Error fetching trending tokens:", error);
		throw error;
	}
};

// Usage example
// const apiKey = "YOUR_API_KEY";
// const chain = "solana";

// getTrendingTokens("solana")
// 	.then((data) => console.log(data))
// 	.catch((error) => console.error(error));

// export const fetchCointest = async () => testdata.data;

const fetchCoin = async (address: string | null | undefined, network: string | undefined) => {
	try {
		const response = await axios.get("https://public-api.birdeye.so/defi/token_overview", {
			params: {
				address: address,
			},
			headers: {
				accept: "application/json",
				"x-chain": network,
				"X-API-KEY": process.env.BIRDEYE_KEY,
			},
		});
		//console.log(response.data.data);
		return response.data.data as TokenData;
	} catch (error) {
		console.error("Error:", error);
	}
};

// Example usage:
//getTokenOverview("So11111111111111111111111111111111111111112", "solana");

// const fetchCoin = async (address: string | null | undefined, network: string | undefined) => {
// 	try {
// 		const response = await axios.get(`https://multichain-api.birdeye.so/${network}/overview/token`, {
// 			params: {
// 				address: address,
// 			},
// 			headers: {
// 				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
// 				Accept: "application/json, text/plain, /",
// 				"Accept-Language": "en-US,en;q=0.5",
// 				"Accept-Encoding": "gzip, deflate, br",
// 				"agent-id": "f28a43fd-ca0e-4dad-a4ea-b28f8f3805b5",
// 				"cf-be":
// 					"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDI5ODk5MTgsImV4cCI6MTcwMjk5MDIxOH0.jowdRorsn5TuuYt0B_SwG36jwlmzKLtsJnav5MZ-iAY",
// 				Origin: "https://birdeye.so",
// 				Connection: "keep-alive",
// 				Referer: "https://birdeye.so/",
// 				"Sec-Fetch-Dest": "empty",
// 				"Sec-Fetch-Mode": "cors",
// 				"Sec-Fetch-Site": "same-site",
// 				"If-None-Match": 'W/"22c8-TcNjeQoXG+lDekngUVup8/479dc"',
// 				TE: "trailers",
// 			},
// 		});

// 		return response.data.data as TokenData;
// 	} catch (error: any) {
// 		//console.log("Error fetching coin:", error);
// 		throw new Error(error.code);
// 		//return null;
// 	}
// };

const formatCoinsMessage = (result: { data: CoinDataType[] }, bet: "bet" | null): string => {
	const coinsMessage: string[] = [];
	const filteredCoinsRange = bet ? [2, 3, 4, 5, 6] : Array.from({ length: result.data.length }, (_, i) => i);

	for (const index of filteredCoinsRange) {
		const element = result.data[index];
		coinsMessage.push(`${index + 1}. ${element.tokenData.name} ( ${element.tokenData.symbol} )`);
	}

	const messageType = bet ? "available for betting" : "top 10 trending";

	return `These are the coins that are ${messageType} on the ${result.data[0].network} chain:\n${coinsMessage.join(
		"\n",
	)}`;
};

const sendAllChainData = async () => {
	const ethdata = await fetchData("solana");
	//JSON.stringify(ethdata);
	//ctx.reply(formatCoinsMessage(ethdata, null));

	const soldata = await fetchData("ethereum");
	//ctx.reply(formatCoinsMessage(soldata, null));

	const bnbdata = await fetchData("bsc");
	//ctx.reply(formatCoinsMessage(bnbdata, null));
	return { ethdata, soldata, bnbdata };
};
//const axios = require("axios");

export async function fetchCoinGeckoData(contractAddress: string, chain: string | undefined) {
	const url = `https://api.coingecko.com/api/v3/coins/${chain}/contract/${contractAddress}`;
	const options = {
		method: "GET",
		headers: { accept: "application/json", "x-cg-demo-api-key": "CG-YSw6sZ9oHcNt7JNmoYoo6qd1" },
	};

	try {
		const response = await axios(url, options);
		//console.log(response);
		return response.data;
	} catch (error) {
		//console.error("Error:", error);
		return null;
		//throw error;
	}
}

export const fetchDxToolsPairData = async (address: string, chain: string | undefined) => {
	const getCurrentUnixTime = Math.floor(Date.now()).toString();
	const url = "https://www.dextools.io/shared/data/pair";
	const params = {
		address: "0x8181b3979299bc4b4eb85b3ec9098b589dbf47ff",
		chain: "base",
		audit: false,
		locks: true,
	};
	const headers = {
		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
		Accept: "application/json",
		"Accept-Language": "en-US,en;q=0.5",
		Referer: `https://www.dextools.io/app/en/${chain}/pair-explorer/${address}?t=${getCurrentUnixTime}`,
	};

	try {
		const response = await axios.get(url, {
			params: params,
			headers: headers,
		});
		return response.data.data[0].token.metrics;
	} catch (error: any) {
		console.log("Error fetching data:", error.code);
		return null;
	}
};
export async function getDexPairDataWithAddress(pairAddresses: string) {
	const url = `https://api.dexscreener.com/latest/dex/tokens/${pairAddresses}`;
	const resultsArray: DexScreenerPair[] = [];

	try {
		const response = await axios.get(url);

		if (!response.data.pairs) return [];
		response.data.pairs.forEach((pair: any) => {
			resultsArray.push({
				chain: pair.chainId,
				dexUrl: pair.url,
				address: pair.baseToken.address,
				name: pair.baseToken.name,
				symbol: pair.baseToken.symbol,
				price: pair.priceUsd,
				mcap: pair.fdv,
				liquidity: pair.liquidity,
			});
		});
		//	return response.data.pairs[0];
		return resultsArray;
	} catch (error) {
		console.error("Error fetching data from Dex Screener API:", error);
		return null;
	}
}

export async function searchDexPairs(query: string) {
	const url = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`;
	const resultsArray: DexScreenerPair[] = [];
	try {
		const response = await axios.get(url);
		response.data.pairs.forEach((pair: any) => {
			resultsArray.push({
				chain: pair.chainId,
				dexUrl: pair.url,
				address: pair.baseToken.address,
				name: pair.baseToken.name,
				symbol: pair.baseToken.symbol,
				price: pair.priceUsd,
				mcap: pair.fdv,
				liquidity: pair.liquidity,
			});
		});

		resultsArray.sort((a, b) => b.mcap - a.mcap);

		const seenAddresses = new Set();
		const uniqueResultsArray = resultsArray.filter((item) => {
			if (seenAddresses.has(item.address)) {
				return false;
			} else {
				seenAddresses.add(item.address);
				return true;
			}
		});

		const filteredResultsArray = uniqueResultsArray.filter((item) =>
			supportedChains.includes(item.chain.toLowerCase()),
		);
		const filtered = filteredResultsArray.filter((filter) => filter.mcap);
		return filtered;
	} catch (error) {
		console.error("Error fetching data from Dex Screener API:", error);
		return null;
	}
}
// Example usage:

export { formatCoinsMessage, sendAllChainData, fetchCoin };
export default fetchData;
