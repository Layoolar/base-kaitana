/**
 * Database: lowdb
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */

// interface HistoricalDataAndGraph {
// 	priceChartBuffer: Buffer;
// 	marketCapChartBuffer: Buffer;
// 	priceHistoricalData: {
// 		time: number;
// 		price: number;
// 		name: string;
// 		marketCap: number;
// 	}[];
// }
import type { TelegramUserInterface } from "@app/types/databases.type";
import configs from "../configs/config";
import lowdb from "lowdb";
import lowdbFileSync from "lowdb/adapters/FileSync";
import { BetData, CoinDataType, Log, Token } from "./commands";
import fetchData from "./fetchCoins";
// onst ChartJsImage = require("chartjs-to-image");
import ChartJsImage from "chartjs-to-image";
import bot from "./telegraf";
import AWS from "aws-sdk";
import { createLogTable } from "./awslogs";
import { createGroupTable } from "./awsGroups";
import { createUserTable } from "./AWSusers";

//
//createLogTable();
export interface MyUser extends TelegramUserInterface {
	walletAddress: string | null;
	bets: BetData[] | [];
	privateKey: string | null;
	mnemonic: string | null;
	baseholding: string[];
	ethholding: string[];
	solWalletAddress: string | null;
	solPrivateKey: string | null;
	solMnemonic: string | null;
	language: "english" | "french" | "spanish" | "arabic" | "chinese";
}
export type Group = {
	id: number;
	currentCalled: string | null;
	callHistory: string[];
};

interface CoinData {
	token: string;
	time: number;
	price: number;
	network: string;
	name: string;
	symbol: string;
	marketCap: number;
}

export interface CoinDataCollection {
	id: string;
	coindata: CoinData[];
	topTenStatus: boolean;
}

type count = number;
const databases = {
	users: lowdb(new lowdbFileSync<{ users: MyUser[] }>(configs.databases.users)),
	ethCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.ethCoinsData)),
	solCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.solCoinsData)),
	bnbCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.bnbCoinsData)),
	leaderboard: lowdb(new lowdbFileSync<{ count: count }>(configs.databases.leaderboard)),
	groups: lowdb(new lowdbFileSync<{ groups: Group[] }>(configs.databases.groups)),
	logs: lowdb(new lowdbFileSync<{ logs: Log[]; filteredLogs: Log[] }>(configs.databases.logs)),
};

databases.ethCoinsData = lowdb(new lowdbFileSync(configs.databases.ethCoinsData));
databases.ethCoinsData.defaults({ coinsData: [] }).write();

databases.solCoinsData = lowdb(new lowdbFileSync(configs.databases.solCoinsData));
databases.solCoinsData.defaults({ coinsData: [] }).write();

databases.bnbCoinsData = lowdb(new lowdbFileSync(configs.databases.bnbCoinsData));
databases.bnbCoinsData.defaults({ coinsData: [] }).write();

databases.users = lowdb(new lowdbFileSync(configs.databases.users));
databases.users.defaults({ users: [] }).write();

databases.leaderboard = lowdb(new lowdbFileSync(configs.databases.leaderboard));
databases.leaderboard.defaults({ count: 0 }).write();

databases.groups = lowdb(new lowdbFileSync(configs.databases.groups));
databases.groups.defaults({ groups: [] }).write();

databases.logs = lowdb(new lowdbFileSync(configs.databases.logs));
databases.logs.defaults({ logs: [], filteredLogs: [] }).write();

/**
 * writeUser()
 * =====================
 * Write user information from telegram context to user database
 *
 * @Context: ctx.update.message.from
 *
 * @interface [TelegramUserInterface](https://github.com/ptkdev-boilerplate/node-telegram-bot-boilerplate/blob/main/app/webcomponent/types/databases.type.ts)
 *
 * @param { TelegramUserInterface } json - telegram user object
 *
 */

// AWS.config.update({
// 	region: "eu-west-2", // e.g., 'us-west-2'
// 	accessKeyId: process.env.DYNAMO_ACCESS_KEY,
// 	secretAccessKey: process.env.DYNAMO_SECRET_KEY,
// });

// Function to update currentCalled and push it into the callHistory array for a group
function updateCurrentCalledAndPushToHistory(groupId: number, currentCalled: string) {
	// Find the group in the database
	const group = databases.groups.get("groups").find({ id: groupId });

	// If the group exists, update its fields
	if (group.value()) {
		group.assign({ currentCalled }).write();
		// Get the current call history
		const callHistory = group.get("callHistory").value();

		// Push the currentCalled value into the callHistory array
		// console.log(callHistory);
		if (!callHistory.includes(currentCalled)) {
			callHistory.push(currentCalled);
			//	console.log(callHistory);
		}

		group.assign({ callHistory: callHistory });
		return;
		// Update currentCalled and callHistory fields
	} else {
		//	console.log(`Group ${groupId} not found in the database.`);
	}
}

// Example usage
// const groupIdToUpdate = 123456789; // Replace with the group ID you want to update
// const newCurrentCalled = "New Value";

// updateCurrentCalledAndPushToHistory(groupIdToUpdate, newCurrentCalled);

function getCurrentCalled(groupId: number) {
	// Find the group in the database
	const group = databases.groups.get("groups").find({ id: groupId });

	// If the group exists, return its currentCalled value
	if (group.value()) {
		return group.get("currentCalled").value();
	} else {
		return null;
	}
}

function getCallHistory(groupId: number) {
	// Find the group in the database
	const group = databases.groups.get("groups").find({ id: groupId });

	// If the group exists, return its callHistory value
	if (group.value()) {
		return group.get("callHistory").value();
	} else {
		//	console.log(`Group ${groupId} not found in the database.`);
		return null;
	}
}
// console.log(databases.users.get("users").value());
function addGroup(groupId: number) {
	// Check if the group already exists in the database
	const group = databases.groups.get("groups").find({ id: groupId }).value();
	// console.log(group);
	if (!group) {
		databases.groups.get("groups").push({ id: groupId, currentCalled: null, callHistory: [] }).write();
	}
	return;
	//	console.log(`Group ${groupId} has been added to the database.`);
}

const addUserHolding = async (userId: number, contractAddress: string, chain: string): Promise<void> => {
	const user = databases.users.get("users").find({ id: userId }).value();
	if (chain == "ethereum") {
		if (user) {
			if (!user.ethholding.includes(contractAddress)) {
				user.ethholding.push(contractAddress);
				databases.users.get("users").find({ id: userId }).assign(user).write();
			}
		}
	} else {
		if (user) {
			if (!user.baseholding.includes(contractAddress)) {
				user.baseholding.push(contractAddress);
				databases.users.get("users").find({ id: userId }).assign(user).write();
			}
		}
	}
};

const removeUserHolding = async (userId: number, contractAddress: string, chain: string): Promise<void> => {
	const user = databases.users.get("users").find({ id: userId }).value();

	if (chain == "ethereum") {
		if (user) {
			const index = user.ethholding.indexOf(contractAddress);
			if (index !== -1) {
				user.ethholding.splice(index, 1);
				databases.users.get("users").find({ id: userId }).assign(user).write();
			} else {
				// console.log("User does not hold this contract address.");
			}
		} else {
			// console.log("User not found.");
		}
	} else {
		if (user) {
			const index = user.baseholding.indexOf(contractAddress);
			if (index !== -1) {
				user.baseholding.splice(index, 1);
				databases.users.get("users").find({ id: userId }).assign(user).write();
			} else {
				// console.log("User does not hold this contract address.");
			}
		} else {
			// console.log("User not found.");
		}
	}
};

const writeUser = async (json: MyUser): Promise<void> => {
	const user_id = databases.users.get("users").find({ id: json.id }).value();

	if (user_id) {
		databases.users.get("users").find({ id: user_id.id }).assign(json).write();
	} else {
		databases.users.get("users").push(json).write();
	}
};
const checkUserExists = (userId: number): boolean => {
	const userInDb = databases.users.get("users").find({ id: userId }).value();
	return !!userInDb;
};
// const getUserLanguage = (userId: number) => {
// 	const userInDb = databases.users.get("users").find({ id: userId }).value();

// 	return userInDb.language as "english" | "french" | "spanish" | "arabic" | "chinese";
// };

// const updateWallet = (userId: number, newWallet: string): boolean => {
// 	const userInDb = databases.users.get("users").find({ id: userId });

// 	if (userInDb.value()) {
// 		userInDb.assign({ walletAddress: newWallet }).write();
// 		return true;
// 	} else {
// 		return false;
// 	}
// };
const isWalletNull = (userId: number): boolean => {
	const userInDb = databases.users.get("users").find({ id: userId }).value();
	return userInDb.walletAddress === null;
};

export const addtoCount = () => {
	const count = databases.leaderboard.get("count").value();
	databases.leaderboard.assign(count + 1);
};

const updateWallet = (userId: number, newWallet: string, newPrivateKey: string, newMnemonic: string | undefined) => {
	const userInDb = databases.users.get("users").find({ id: userId });

	if (userInDb.value()) {
		userInDb
			.assign({
				walletAddress: newWallet,
				privateKey: newPrivateKey,
				mnemonic: newMnemonic,
			})
			.write();
		return true;
	} else {
		return false;
	}
};
const updateSolWallet = (userId: number, newWallet: string, newPrivateKey: string) => {
	const userInDb = databases.users.get("users").find({ id: userId });

	if (userInDb.value()) {
		userInDb
			.assign({
				solWalletAddress: newWallet,
				solPrivateKey: newPrivateKey,
			})
			.write();
		return true;
	} else {
		return false;
	}
};
const getUserWalletDetails = (userId: number) => {
	const userInDb = databases.users.get("users").find({ id: userId }).value();

	if (userInDb) {
		const {
			walletAddress,
			privateKey,
			mnemonic,
			baseholding,
			ethholding,
			solMnemonic,
			solPrivateKey,
			solWalletAddress,
		} = userInDb;
		return {
			walletAddress,
			privateKey,
			mnemonic,
			baseholding,
			ethholding,
			solMnemonic,
			solPrivateKey,
			solWalletAddress,
		};
	} else {
		return null; // Or you can throw an error or handle the case as needed
	}
};

// generateTimeAndPriceGraph();
// console.log(`This request was made on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);
// console.log("hey");
// setInterval(async () => await updateDbWithTopTen("ethereum", "ethCoinsData"), 5000);
// setInterval(async () => await updateDbWithTopTen("solana", "solCoinsData"), 5000);
// setInterval(async () => await updateDbWithTopTen("bsc", "bnbCoinsData"), 5000);

function extractTimeAndPrice(data: { price: number; marketCap: number }[]) {
	let priceArray = data.map((item) => item.price);
	let marketCapArray = data.map((item) => item.marketCap);
	if (priceArray.length < 6) {
		for (let i = 0; i < 6 - priceArray.length; i++) {
			priceArray = [0, ...priceArray];
		}
	}

	if (marketCapArray.length < 6) {
		for (let i = 0; i < 6 - marketCapArray.length; i++) {
			marketCapArray = [0, ...marketCapArray];
		}
	}

	return { priceArray, marketCapArray };
}

const getHistoricalDataAndGraph = async (tokenName: string, chain: string) => {
	const tokens: Token[] = (await fetchData(chain)).tokens;
	let db: string;

	const priceHistoricalData: { time: number; price: number; name: string; marketCap: number }[] = [];
	// console.log(tokens);
	const token = tokens.filter((item) => item.name === tokenName);

	if (chain === "ethereum") {
		db = "ethCoinsData";
	} else if (chain === "bnb") {
		db = "bnbCoinsData";
	} else {
		db = "solCoinsData";
	}
	if (token.length === 0) {
		return null;
	}

	// @ts-ignore
	const historical = databases[db].get("coinsData").find({ id: token[0].token });

	if (!historical.value()) {
		return null;
	}
	// console.log(historical.value());
	// const userInDb = databases.users.get("users").find({ id: userId });

	for (let index = 0; index < historical.value().coindata.length; index++) {
		const element = historical.value().coindata[index];
		priceHistoricalData.push({
			time: (index + 1) * 5,
			price: element.price,
			name: element.name,
			marketCap: element.marketCap,
		});
	}

	const { priceArray, marketCapArray } = extractTimeAndPrice(priceHistoricalData);

	const myPriceChart = new ChartJsImage();
	myPriceChart.setConfig({
		type: "line",
		data: {
			labels: [0, 5, 10, 15, 20, 25],
			datasets: [
				{
					label: "Coin price",
					data: priceArray.slice(-6),
					borderColor: "red",
					backgroundColor: "transparent",
				},
			],
		},
	});
	// myPriceChart.setBackgroundColor("transparent");
	const myMcapChart = new ChartJsImage();

	myMcapChart.setConfig({
		type: "line",
		data: {
			labels: [0, 5, 10, 15, 20, 25],
			datasets: [
				{
					label: "Market cap",
					data: marketCapArray.slice(-6),
					borderColor: "red",
					backgroundColor: "transparent",
				},
			],
		},
	});

	// console.log(myChart.getUrl());

	const buf = await myPriceChart.toBinary();
	const capBuf = await myMcapChart.toBinary();
	return { priceChartBuffer: buf, marketCapChartBuffer: capBuf, priceHistoricalData: priceHistoricalData };
};

// this should be hidden

// analyse the data and mention if there is a common market trend that can give informartion in buy or sell.

// main("exit");

const removeOldLogs = async (): Promise<void> => {
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
	const logs = databases.logs.get("filteredLogs").value();

	const updatedLogs = logs.filter((log: Log) => new Date(log.date) >= oneHourAgo);
	databases.logs.set("filteredLogs", updatedLogs).write();
};

// setInterval(async () => {
// 	await removeOldLogs();
// }, 10 * 60 * 1000);
const addOrUpdateLog = (log: Log) => {
	const existingLog = databases.logs.get("logs").find({ ca: log.ca }).value();

	if (existingLog) {
		existingLog.queries += 1;
		existingLog.token = log.token; // Update other fields if necessary
		existingLog.date = new Date().toISOString(); // Update date to current date
		databases.logs.get("logs").push(existingLog).write();
	} else {
		log.queries = 1; // Initialize queries to 1 for new logs
		log.date = new Date().toISOString(); // Set date to current date for new logs
		databases.logs.get("logs").push(log).write();
		databases.logs.get("filteredLogs").push(log).write();
	}
};
const getAllLogs = (): Log[] => {
	const logs = databases.logs.get("logs").value();

	return logs;
};
