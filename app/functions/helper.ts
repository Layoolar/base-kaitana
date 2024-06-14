import { fetchCoin } from "./fetchCoins";
import { TokenData } from "./timePriceData";
import { ethers } from "ethers";
import axios from "axios";
import { getEtherBalance, getTokenBalance } from "./checkBalance";
import bot from "./telegraf";
import fs from "fs";
import path from "path";
import solanaWeb3 from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { getSolBalance } from "./checksolbalance";
import { openai } from "./queryApi";

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
export async function getSolPrice() {
	try {
		const response = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
		const price = response.data.solana.usd;
		return price;
	} catch (error) {
		console.error("Error fetching SOL price:", error);
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

// Function to create a new Solana wallet with mnemonic
// function uint8ArrayToBase64(uint8Array: Uint8Array): string {
// 	let binaryString = "";
// 	uint8Array.forEach((byte) => {
// 		binaryString += String.fromCharCode(byte);
// 	});
// 	return btoa(binaryString);
// }

// Function to create a new Solana wallet with mnemonic
export async function createSolWallet() {
	// Generate a random mnemonic (24 words)
	const mnemonic = bip39.generateMnemonic(256); // 24-word mnemonic

	// Derive seed from mnemonic
	const seed = await bip39.mnemonicToSeed(mnemonic);

	// Derive the keypair from the seed
	const path = "m/44'/501'/0'/0'"; // BIP44 path for Solana
	const derivedSeed = derivePath(path, seed.toString("hex")).key;
	const keypair = solanaWeb3.Keypair.fromSeed(derivedSeed);

	// Get the public key and private key
	const publicKey = keypair.publicKey.toBase58();
	const privateKeyUint8Array = keypair.secretKey;
	const privateKeyBase64 = privateKeyUint8Array;

	// Return the wallet object containing the public key, private key (Base64), and mnemonic
	return {
		address: publicKey,
		privateKey: privateKeyBase64,
		mnemonic: mnemonic,
	};
}
// Create a new wallet and log the wallet details
// createSolWallet()
// 	.then((wallet) => {
// 		console.log("New Wallet Created");
// 		console.log("Address:", wallet.address);
// 		console.log("Private Key:", wallet.privateKey);
// 		console.log("Mnemonic:", wallet.mnemonic);
// 	})
// 	.catch((error) => {
// 		console.error("Error creating wallet:", error);
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
export async function getAllTokenBalances(walletAddress: string, tokenAddresses: string[], chain: string) {
	try {
		let balancesString = "";

		let ethBalance;
		const currentEthPrice = await getEthPrice();

		if (chain === "base") {
			let res = await getEtherBalance(walletAddress);

			ethBalance = res?.base;
		} else {
			let res = await getEtherBalance(walletAddress);
			ethBalance = res?.eth;
		}

		if (!ethBalance) {
			return;
		}

		let totalEth = parseFloat(ethBalance);

		let totalUsd = totalEth * currentEthPrice;

		for (let i = 0; i < tokenAddresses.length; i++) {
			const balance = await getTokenBalance(walletAddress, tokenAddresses[i], chain);
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

export async function getAllSolTokenBalances(
	tokenAddresses: { mintAddress: string; tokenBalance: number }[],
	walletAddress: string,
) {
	try {
		let balancesString = "";

		const solBalance = await getSolBalance(walletAddress);
		const currentSolPrice = await getSolPrice();

		if (!solBalance) {
			return;
		}

		let totalSol = solBalance;

		let totalUsd = totalSol * currentSolPrice;

		for (let i = 0; i < tokenAddresses.length; i++) {
			const balance = tokenAddresses[i].tokenBalance;
			if (balance !== null) {
				const tokenInfo = await processToken(tokenAddresses[i].mintAddress);
				if (!tokenInfo) continue; // Skip token if info not available
				const tokenPriceUsd = balance * tokenInfo.token.price;
				const tokenPriceSol = tokenPriceUsd / currentSolPrice;
				totalSol += tokenPriceSol;
				totalUsd += tokenPriceUsd;
				balancesString += `${i + 1}. <b>${tokenInfo.token.name}</b>\n\tAmount: <b>${balance.toFixed(
					2,
				)}</b>\n\tValue: <b>$${tokenPriceUsd.toFixed(2)} / ${tokenPriceSol.toFixed(5)} SOL</b>\n\n`;
			}
		}
		balancesString += `Balance: ${solBalance.toFixed(5)} SOL\nNet Worth: ${totalSol.toFixed(
			5,
		)} SOL / $${totalUsd.toFixed(2)}\n`;

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

export const downloadFile = async (fileId: string): Promise<string> => {
	const file = await bot.telegram.getFileLink(fileId);
	//const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
	const url = file.href;

	const response = await axios({
		url,
		method: "GET",
		responseType: "stream",
	});

	const filePath = path.join(__dirname, "voice_note.ogg");
	const writer = fs.createWriteStream(filePath);

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on("finish", () => resolve(filePath));
		writer.on("error", reject);
	});
};

export const deleteFile = (filePath: string): void => {
	fs.unlink(filePath, (err) => {
		if (err) {
			//console.error("Error deleting file:", err);
		} else {
			//console.log("File deleted successfully");
		}
	});
};

export const transcribeAudio = async (filePath: string): Promise<string> => {
	try {
		const transcription = await openai.audio.transcriptions.create({
			// @ts-ignore
			file: fs.createReadStream(filePath),
			model: "whisper-1",
			response_format: "text",
		});
		// @ts-ignore
		return transcription;
	} catch (error) {
		//		console.error("Error:", error);
		throw error;
	}
};
