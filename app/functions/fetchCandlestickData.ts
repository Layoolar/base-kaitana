import axios from "axios";

export async function fetchOHLCVData(
	address: string,

	type: string,
	timeFrom: number,
	timeTo: number,
	chain: string | undefined,
) {
	const url = "https://public-api.birdeye.so/defi/ohlcv";

	try {
		const response = await axios.get(url, {
			headers: {
				accept: "application/json",
				"x-chain": chain,
				"X-API-KEY": "061eef71caa947a3b82c8dbda8bbdf63",
			},
			params: {
				address: address,
				type: type,
				time_from: timeFrom,
				time_to: timeTo,
			},
		});

		return response.data.data;
	} catch (error) {
		console.error("Error fetching OHLCV data:", error);
		throw error;
	}
}

// fetchOHLCVData("So11111111111111111111111111111111111111112", "15m", 1691997839, 1692266639, "solana")
// 	.then((data) => console.log(data))
// 	.catch((error) => console.error(error));

// export async function fetchOHLCVData(
// 	address: string,
// 	currency: string,
// 	type: string,
// 	timeFrom: number,
// 	timeTo: number,
// 	chain: string | undefined,
// ) {
// 	const url = `https://multichain-api.birdeye.so/${chain}/amm/ohlcv`;
// 	const params = {
// 		address: address,
// 		currency: currency,
// 		type: type,
// 		time_from: timeFrom,
// 		time_to: timeTo,
// 	};

// 	const headers = {
// 		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
// 		Accept: "application/json, text/plain, /",
// 		"Accept-Language": "en-US,en;q=0.5",
// 		"Accept-Encoding": "gzip, deflate, br",
// 		"agent-id": "f28a43fd-ca0e-4dad-a4ea-b28f8f3805b5",
// 		"cf-be":
// 			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDI5OTAzMzAsImV4cCI6MTcwMjk5MDYzMH0.E0-mp3KcBGB2k_CivhRFIoSkecfVL14scWJOXZxVC_g",
// 		Origin: "https://birdeye.so",
// 		Connection: "keep-alive",
// 		Referer: "https://birdeye.so/",
// 		"Sec-Fetch-Dest": "empty",
// 		"Sec-Fetch-Mode": "cors",
// 		"Sec-Fetch-Site": "same-site",
// 		TE: "trailers",
// 		"Content-Type": "application/json",
// 	};

// 	try {
// 		const response = await axios.get(url, {
// 			params: params,
// 			headers: headers,
// 			responseType: "json",
// 			timeout: 10000,
// 		});

// 		return response.data.data;
// 	} catch (error) {
// 		console.error("Error fetching data:", error);
// 		return null;
// 	}
// }

// // Example usage:
