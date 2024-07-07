// const solanaWeb3 = require("@solana/web3.js");
// const splToken = require("@solana/spl-token");
import solanaWeb3 from "@solana/web3.js";
import splToken from "@solana/spl-token";
// import { processToken } from "./helper";

// Define the RPC endpoint
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=7ac71d07-8188-40ac-bacc-d91d36b61b38";

// Create a connection to the Solana cluster
const connection = new solanaWeb3.Connection(RPC_ENDPOINT);

// Function to get the SOL balance of a wallet
export async function getSolBalance(walletAddress) {
	// Create a PublicKey object from the wallet address

	try {
		// Get the balance in lamports
		const publicKey = new solanaWeb3.PublicKey(walletAddress);
		const balanceLamports = await connection.getBalance(publicKey);

		//connection.getTokenAccountBalance();
		// connection.getTokenAccountsByOwner;

		// Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)

		const balanceSol = balanceLamports / solanaWeb3.LAMPORTS_PER_SOL;

		return balanceSol;
	} catch (error) {
		console.error("Error getting SOL balance:", error);
		return null;
	}
}

// Function to get the SPL token balances of a wallet
// async function getTokenBalances(walletAddress) {
// 	try {
// 		// Create a PublicKey object from the wallet address
// 		const publicKey = new solanaWeb3.PublicKey(walletAddress);

// 		// Get the token accounts by owner
// 		const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
// 			programId: splToken.TOKEN_PROGRAM_ID,
// 		});

// 		// Iterate through the token accounts and fetch balances
// 		const balances = {};
// 		for (let tokenAccountInfo of tokenAccounts.value) {
// 			const tokenAccountPubkey = tokenAccountInfo.pubkey;
// 			const tokenAccountData = splToken.AccountLayout.decode(tokenAccountInfo.account.data);

// 			// Get the token mint address
// 			const mintAddress = new solanaWeb3.PublicKey(tokenAccountData.mint);
// 			// Get the token balance (amount) as BigInt
// 			const balance = BigInt(tokenAccountData.amount);

// 			// Fetch mint information directly from the connection
// 			const mintInfo = await connection.getParsedAccountInfo(mintAddress);
// 			const decimals = mintInfo.value.data.parsed.info.decimals;

// 			// Convert the balance to a readable format (depending on the token's decimals)
// 			const balanceReadable = Number(balance) / Math.pow(10, decimals);

// 			balances[mintAddress.toString()] = balanceReadable;
// 		}

// 		return balances;
// 	} catch (error) {
// 		console.error("Error getting token balances:", error);
// 		return null;
// 	}
// }

// const token = processToken("So11111111111111111111111111111111111111112");
// console.log(token);
// Example usage
const walletAddress = "7Y3Hn4ak2QeyUMcGPu9NGqYpUo2mjadZimvBzEPAN3pZ";

// Check SOL balance
// getSolBalance(walletAddress).then((balance) => {
// 	if (balance !== null) {
// 		console.log(`SOL balance: ${balance} SOL`);
// 	} else {
// 		console.log("Failed to retrieve SOL balance.");
// 	}
// });

// Check SPL token balances
// getTokenBalances(walletAddress).then((balances) => {
// 	if (balances !== null) {
// 		console.log("Token balances:");
// 		for (const [mintAddress, balance] of Object.entries(balances)) {
// 			console.log(`Token: ${mintAddress}, Balance: ${balance}`);
// 		}
// 	} else {
// 		console.log("Failed to retrieve token balances.");
// 	}
// });
export async function getSolTokenAccounts(wallet) {
	const tokens = [];
	const filters = [
		{
			dataSize: 165, //size of account (bytes)
		},
		{
			memcmp: {
				offset: 32, //location of our query in the account (bytes)
				bytes: wallet, //our search criteria, a base58 encoded string
			},
		},
	];
	const accounts = await connection.getParsedProgramAccounts(
		splToken.TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
		{ filters: filters },
	);
	//console.log(`Found ${accounts.length} token account(s) for wallet ${wallet}.`);
	accounts.forEach((account, i) => {
		//Parse the account data
		const parsedAccountInfo = account.account.data;
		const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
		const tokenBalance = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
		//Log results

		//	const bal of parsedAccountInfo
		// console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
		// console.log(`--Token Mint: ${mintAddress}`);
		// console.log(`--Token Balance: ${tokenBalance}`);
		//console.log(parsedAccountInfo);
		tokens.push({ mintAddress: mintAddress, tokenBalance: tokenBalance });
	});
	//	console.log(tokens);
	const filteredTokens = tokens.filter((token) => token.tokenBalance !== 0);
	return filteredTokens;
}

export const getParticularSolTokenBalance = async (mint, wallet) => {
	try {
		const tokens = await getSolTokenAccounts(wallet);

		const filtered = tokens.filter((token) => token.mintAddress === mint);
		//console.log(filtered);
		return filtered;
	} catch (error) {
		console.log(error);
		return null;
	}
};
//getTokenAccounts(walletAddress);
//getParticularTokenBalance("CzkM8bzWFdXsjtZQnz2piTxJKPtJ5mfTL8S6sNZg7n7S", walletAddress);
