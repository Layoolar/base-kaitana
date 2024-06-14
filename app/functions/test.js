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
// async function getCurrentUnixTime() {
// 	console.log(await getSolPrice());
// }

// getCurrentUnixTime();
// Example usage:
// fetchDataFromDexTools("base", "0x8181b3979299bc4b4eb85b3ec9098b589dbf47ff").then((data) => {
// 	if (data) {
// 		console.log(data);
// 	} else {
// 		console.log("Failed to fetch data.");
// 	}
// });

const solanaWeb3 = require("@solana/web3.js");
const splToken = require("@solana/spl-token");

// Create a connection to the Solana devnet
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=7ac71d07-8188-40ac-bacc-d91d36b61b38";

// Create a connection to the Solana cluster
const connection = new solanaWeb3.Connection(RPC_ENDPOINT);

// Replace with the owner's public key (wallet address) and the token mint address
const ownerPublicKey = new solanaWeb3.PublicKey("GGztQqQ6pCPaJQnNpXBgELr5cs3WwDakRbh1iEMzjgSJ");
const tokenMintAddress = new solanaWeb3.PublicKey("7atgF8KQo4wJrD5ATGX7t1V2zVvykPJbFfNeVf1icFv1");

// Function to find the associated token account and get the balance
async function getTokenBalance(ownerPublicKey, tokenMintAddress) {
	// Find the associated token account
	const associatedTokenAddress = await splToken.getAssociatedTokenAddress(
		tokenMintAddress,
		ownerPublicKey,
		false, // Allow owner off curve (for Solana accounts, this should be false)
		splToken.TOKEN_PROGRAM_ID,
		splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
	);

	// Get the token account balance
	const tokenAccountInfo = await connection.getTokenAccountBalance(associatedTokenAddress);

	// Return the balance
	return tokenAccountInfo.value.amount;
}

// Call the function and print the balance
// getTokenBalance(ownerPublicKey, tokenMintAddress)
// 	.then((balance) => {
// 		console.log(`Token balance: ${balance}`);
// 	})
// 	.catch((err) => {
// 		console.error("Error fetching token balance:", err);
// 	});

async function searchDexPairs(query) {
	const url = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`;
	const resultsArray = [];
	try {
		const response = await axios.get(url);
		response.data.pairs.forEach((pair) => {
			resultsArray.push({
				chain: pair.chainId,
				dexUrl: pair.url,
				address: pair.baseToken.address,
				name: pair.baseToken.name,
				symbol: pair.baseToken.symbol,
				price: pair.priceUsd,
				mcap: pair.fdv,
			});
		});
		return resultsArray;
	} catch (error) {
		console.error("Error fetching data from Dex Screener API:", error);
		return null;
	}
}

// // Example usage
(async () => {
	const query = "BONK"; // Replace with your desired query

	const data = await searchDexPairs(query);
	if (data) {
		console.log("Dex Screener Search Data:", data);
	} else {
		console.log("Failed to fetch Dex Screener search data.");
	}
})();
