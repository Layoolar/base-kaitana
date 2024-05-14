const axios = require("axios");

// Function to get Ethereum price from CoinGecko API using Axios
async function getEthPrice() {
	try {
		const response = await axios.get(
			"https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
		);
		const price = response.data.ethereum.usd;
		return price;
	} catch (error) {
		console.log(error);
		return null;
	}
}

//const axios = require("axios");

const apiKey = "b6973a03-0548-4370-b453-f8a8983d2b7f"; // Replace with your CoinMarketCap API key

async function getTokenInfo(tokenSymbol) {
	const networks = ["solana", "bsc", "ethereum", "base"];

	try {
		for (const network of networks) {
			const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${tokenSymbol}&aux=${network}`;

			const response = await axios.get(url, {
				headers: {
					"X-CMC_PRO_API_KEY": apiKey,
				},
			});

			const tokenData = response.data.data[tokenSymbol];
			if (tokenData) {
				const marketCap = tokenData.quote.USD.market_cap;
				const supply = tokenData.total_supply;
				const ath = tokenData.quote.USD.ath;
				const atl = tokenData.quote.USD.atl;

				return { network, marketCap, supply, ath, atl };
			}
		}

		throw new Error("Token not found on any network");
	} catch (error) {
		console.error("Error fetching data from CoinMarketCap API:", error);
		return null;
	}
}

//Example usage
const tokenSymbol = "ETH"; // Replace with the symbol of the token you're interested in
// getTokenInfo(tokenSymbol).then((tokenInfo) => {
// 	if (tokenInfo) {
// 		console.log(`Market Cap of ${tokenSymbol}: $${tokenInfo.marketCap}`);
// 		console.log(`Total Supply of ${tokenSymbol}: ${tokenInfo.supply}`);
// 	} else {
// 		console.log("Token information not available");
// 	}
// });
//const axios = require("axios");
//const axios = require("axios");

// Function to get current time in Unix timestamp format
function getCurrentUnixTime() {
	return Math.floor(Date.now() / 1000);
}


// Example usage:
fetchDataFromDexTools("base", "0x8181b3979299bc4b4eb85b3ec9098b589dbf47ff").then((data) => {
	if (data) {
		console.log(data);
	} else {
		console.log("Failed to fetch data.");
	}
});
