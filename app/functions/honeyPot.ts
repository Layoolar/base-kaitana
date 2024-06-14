const axios = require("axios");

// const API_KEY = "{APIKEY}"; // Replace with your actual API key
type AirdropSummary = {
	totalTxs: number;
	totalAmountWei: string;
	totalTransfers: number;
};

type TokenData = {
	name: string;
	symbol: string;
	decimals: number;
	address: string;
	totalHolders: number;
	airdropSummary: AirdropSummary;
};

type Summary = {
	risk: string;
	riskLevel: number;
	flags: any[];
};

type Honeypot = {
	isHoneypot: boolean;
};

type ApiResponse = {
	tokenData: TokenData;
	summary: Summary;
	honeypot: Honeypot;
	flags: any[];
	success: boolean;
};

export const isHoneypot = async (address: string) => {
	const options = {
		method: "GET",
		url: "https://api.honeypot.is/v2/IsHoneypot",
		headers: {
			"X-API-KEY": "",
		},
		params: {
			address: address,
		},
	};

	try {
		const response = await axios(options);

		return {
			tokenData: response.data.token,
			summary: response.data.summary,
			honeypot: response.data.honeypotResult,
			flags: response.data.flags,
			success: response.data.simulationSuccess,
		} as ApiResponse;
	} catch (error: any) {
		//console.error("Error:", error);
		//	console.log(error.response.data.error);
		throw new Error(error.response.data.error);
	}
};

//Example usage
// const address = "0x24f303e08227cB3bC8EDd607a2F639B86423D5bD";
// isHoneypot(address)
// 	.then((data) => {
// 		console.log("API Data:", data.honeypot.isHoneypot);
// 	})
// 	.catch((error) => {
// 		console.log("Failed to retrieve data:", error.message);
// 	});
