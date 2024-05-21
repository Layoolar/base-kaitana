import { fetchCoin } from "./fetchCoins";
import { TokenData } from "./timePriceData";
import { ethers } from "ethers";
import axios from "axios";
import { getEtherBalance, getTokenBalance } from "./checkBalance";

export function isEmpty(obj: any) {
	return Object.keys(obj).length === 0;
}

export async function getEthPrice() {
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
export function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processToken(address: string | null) {
	if (address?.slice(0, 2) !== "0x") {
		// Check if the address starts with "0x" for Ethereum chain
		const token = (await fetchCoin(address, "solana")) as TokenData;
		if (token) {
			return { chain: "solana", address, token };
		} else {
			return null; // Token not found
		}
	} else {
		// Check for BSC token
		const bsctoken = (await fetchCoin(address, "bsc")) as TokenData;
		if (!isEmpty(bsctoken)) {
			return { chain: "bsc", address, token: bsctoken };
		}

		// Check for Ethereum token
		const ethtoken = (await fetchCoin(address, "ethereum")) as TokenData;
		if (!isEmpty(ethtoken)) {
			return { chain: "ethereum", address, token: ethtoken };
		}

		// Check for Base token
		const basetoken = (await fetchCoin(address, "base")) as TokenData;
		if (!isEmpty(basetoken)) {
			return { chain: "base", address, token: basetoken };
		} else {
			return null;
		}

		// If token not found for any chain, return null
		//return null;
	}
}

// Function to create a new Ethereum wallet and return all logged items
export function createWallet() {
	// Generate a random wallet
	const wallet = ethers.Wallet.createRandom();

	// Log the wallet's details
	const loggedItems = {
		walletAddress: wallet.address,
		privateKey: wallet.privateKey,
		mnemonic: wallet.mnemonic?.phrase,
	};
	// console.log("Wallet Address:", loggedItems.walletAddress);
	// console.log("Private Key:", loggedItems.privateKey);
	// console.log("Mnemonic:", loggedItems.mnemonic);

	// Return all logged items
	return loggedItems;
}

// Call the createWallet function to create a new wallet and get all logged items
// const walletDetails = createWallet();
// console.log(walletDetails);

// const tokenInfo = await processToken(address);

// if (tokenInfo === null) {
// 	// Token not found
// 	await ctx.reply("I could not find the token. Please check the address and try again.");
// 	return;
// } else if (tokenInfo.offerChoice) {
// 	// Offer options to choose a specific token
// 	ctx.scene.session.analysisStore.address = tokenInfo.address;
// 	return await ctx.replyWithHTML(
// 		`<b>🤔 Choose the specific token</b>`,
// 		Markup.inlineKeyboard([
// 			Markup.button.callback(`${tokenInfo.bsctoken.name}`, `token_${tokenInfo.bsctoken.name}`),
// 			Markup.button.callback(`${tokenInfo.ethtoken.name}`, `token_${tokenInfo.ethtoken.name}`),
// 		]),
// 	);
// } else {
// 	// Token found, store token information
// 	ctx.scene.session.analysisStore.chain = tokenInfo.chain;
// 	ctx.scene.session.analysisStore.address = tokenInfo.address;
// 	ctx.scene.session.analysisStore.token = tokenInfo.token;
// }

// Function to send Ethereum
// async function sendEther(privateKey: string, recipientAddress: string, amountInEther: string) {
// 	// Define your provider (e.g., a connection to the Ethereum mainnet or a testnet)
// 	const provider = ethers.getDefaultProvider("mainnet"); // Change 'mainnet' to 'ropsten' or another testnet as needed

// 	// Create a wallet instance using the private key and connect it to the provider
// 	const wallet = new ethers.Wallet(privateKey, provider);

// 	try {
// 		// Create a transaction object
// 		const tx: ethers.TransactionRequest = {
// 			to: recipientAddress,
// 			value: ethers.parseEther(amountInEther), // Convert the amount from Ether to Wei
// 			gasLimit: 21000, // Standard gas limit for a simple transaction
// 			// Current gas price
// 		};

// 		const gasPrice = await provider.estimateGas(tx); //gasprice
// 		const transactionResponse = await wallet.sendTransaction(tx);

// 		// Wait for the transaction to be confirmed
// 		const transactionReceipt = await transactionResponse.wait();

// 		// Return the transaction receipt
// 		return transactionReceipt;
// 	} catch (error) {
// 		// Handle errors
// 		console.log(error);
// 	}
// }

// // Example usage:
// // const privateKey = "YOUR_PRIVATE_KEY";
// // const recipientAddress = "RECIPIENT_ADDRESS";
// // const amountInEther = "0.01"; // Amount to send in Ether

// // sendEther(privateKey, recipientAddress, amountInEther)
// // 	.then((transactionReceipt) => {
// // 		console.log("Transaction receipt:", transactionReceipt);
// // 	})
// // 	.catch((error) => {
// // 		console.error("An error occurred:", error);
// // 	});

// //import { ethers } from "ethers";

// async function sendErc20Token(
// 	privateKey: string,
// 	tokenContractAddress: string,
// 	recipientAddress: string,
// 	amountInToken: string,
// 	decimals: number = 18,
// ): Promise<void> {
// 	// Define your provider (e.g., a connection to the Ethereum mainnet or a testnet)
// 	const provider = ethers.getDefaultProvider("mainnet"); // Change 'mainnet' to 'ropsten' or another testnet as needed

// 	// Create a wallet instance using the private key and connect it to the provider
// 	const wallet = new ethers.Wallet(privateKey, provider);

// 	// Define the ABI of the ERC-20 token contract (minimal ABI for transfer function)
// 	const erc20Abi = [
// 		// Only include the transfer function ABI
// 		"function transfer(address to, uint256 amount) public returns (bool)",
// 	];

// 	// Create a contract instance for the ERC-20 token
// 	const tokenContract = new ethers.Contract(tokenContractAddress, erc20Abi, wallet);

// 	// Convert the amount to the token's units (wei)
// 	const amountInWei = ethers.parseUnits(amountInToken, decimals);

// 	try {
// 		// Send the ERC-20 token using the transfer function
// 		const transactionResponse = await tokenContract.transfer(recipientAddress, amountInWei);

// 		// Wait for the transaction to be confirmed
// 		const transactionReceipt = await transactionResponse.wait();

// 		// Log the transaction receipt
// 		console.log("Transaction receipt:", transactionReceipt);
// 	} catch (error) {
// 		// Handle errors
// 		throw new Error("Failed to send ERC-20 token: " + error);
// 	}
// }

// // Example usage:
// const privateKey = "YOUR_PRIVATE_KEY";
// const tokenContractAddress = "ERC20_TOKEN_CONTRACT_ADDRESS";
// const recipientAddress = "RECIPIENT_ADDRESS";
// const amountInToken = "10"; // Amount to send in token units
// const decimals = 18; // Decimals of the ERC-20 token

// sendErc20Token(privateKey, tokenContractAddress, recipientAddress, amountInToken, decimals)
// 	.then(() => {
// 		console.log("ERC-20 token sent successfully");
// 	})
// 	.catch((error) => {
// 		console.error("An error occurred:", error);
// 	});

export const extractTimeFromPrompt = (prompt: string) => {
	// Regular expression to match time formats like "12:30pm", "3pm", "9:45 AM", etc.
	const timeRegex = /(\d{1,2}):?(\d{2})?\s?(am|pm)?/gi;

	// Match time format in the prompt
	const matches = prompt.match(timeRegex);

	if (matches) {
		// Extract hours, minutes, and meridiem from the matched time
		const [hour, minute = "00", meridiem = "am"] = matches[0].split(/:| /);

		// Convert time to 24-hour format
		let hour24 = parseInt(hour, 10);
		if (meridiem.toLowerCase() === "pm" && hour24 !== 12) {
			hour24 += 12;
		} else if (meridiem.toLowerCase() === "am" && hour24 === 12) {
			hour24 = 0;
		}

		// Get current date and set the extracted time
		const currentDate = new Date();
		currentDate.setHours(hour24, parseInt(minute, 10), 0, 0);

		// Get current time in milliseconds
		const currentTime = currentDate.getTime();

		// Calculate time difference from the current time
		return (currentTime - Date.now()).toString();
	} else {
		return null;
	}
};

// Function to get all token balances
export async function getAllTokenBalances(walletAddress: string, tokenAddresses: string[]) {
	try {
		let balancesString = "";

		const currentEthPrice = await getEthPrice();
		let ethBalance = (await getEtherBalance(walletAddress)) || "0";
		let totalEth = parseFloat(ethBalance);
		let totalUsd = totalEth * currentEthPrice;

		for (let i = 0; i < tokenAddresses.length; i++) {
			const balance = await getTokenBalance(walletAddress, tokenAddresses[i]);
			if (balance !== null) {
				const tokenInfo = await processToken(tokenAddresses[i]);
				if (!tokenInfo) continue; // Skip token if info not available
				const tokenPriceUsd = balance * tokenInfo.token.price;
				const tokenPriceEth = tokenPriceUsd / currentEthPrice;
				totalEth += tokenPriceEth;
				totalUsd += tokenPriceUsd;
				balancesString += `${i + 1}. <b>${
					tokenInfo.token.name
				}</b>\n\tAmount: <b>${balance}</b>\n\tValue: <b>$${tokenPriceUsd.toFixed(2)} / ${tokenPriceEth.toFixed(
					5,
				)} ETH</b>\n\n`;
			}
		}
		balancesString += `Balance: ${parseFloat(ethBalance).toFixed(5)} ETH\nNet Worth: ${totalEth.toFixed(
			5,
		)} Eth / $${totalUsd.toFixed(2)}\n`;

		return balancesString;
	} catch (error) {
		console.error("Error getting all token balances:", error);
		return null;
	}
}

export const addMillisecondsToDate = (milliseconds: number) => {
	// Get the current time in milliseconds
	const currentTime = Date.now();

	// Calculate the target time by adding the milliseconds to the current time
	const targetTime = currentTime + milliseconds;

	// Create a new Date object representing the target time
	const targetDate = new Date(targetTime);

	return targetDate;
};
