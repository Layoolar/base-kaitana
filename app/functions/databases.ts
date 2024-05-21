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
import configs from "@configs/config";
import lowdb from "lowdb";
import lowdbFileSync from "lowdb/adapters/FileSync";
import { BetData, CoinDataType } from "./commands";
import fetchData from "./fetchCoins";
// onst ChartJsImage = require("chartjs-to-image");
import ChartJsImage from "chartjs-to-image";
import bot from "./telegraf";

//

interface MyUser extends TelegramUserInterface {
	walletAddress: string | null;
	bets: BetData[] | [];
	privateKey: string | null;
	mnemonic: string | null;
	holding: string[];
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

interface leaderboardPlayer {
	id: number;
	username: string | undefined;
	wins: number;
	losses: number;
}
const databases = {
	users: lowdb(new lowdbFileSync<{ users: MyUser[] }>(configs.databases.users)),
	ethCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.ethCoinsData)),
	solCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.solCoinsData)),
	bnbCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.bnbCoinsData)),
	leaderboard: lowdb(new lowdbFileSync<{ leaders: leaderboardPlayer[] }>(configs.databases.bnbCoinsData)),
	groups: lowdb(new lowdbFileSync<{ groups: Group[] }>(configs.databases.groups)),
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
databases.leaderboard.defaults({ leaders: [] }).write();

databases.groups = lowdb(new lowdbFileSync(configs.databases.groups));
databases.groups.defaults({ groups: [] }).write();

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

// Function to update currentCalled and push it into the callHistory array for a group
export function updateCurrentCalledAndPushToHistory(groupId: number, currentCalled: string) {
	// Find the group in the database
	const group = databases.groups.get("groups").find({ id: groupId });

	// If the group exists, update its fields
	if (group.value()) {
		group.assign({ currentCalled }).write();
		// Get the current call history
		const callHistory = group.get("callHistory").value();

		// Push the currentCalled value into the callHistory array
		//console.log(callHistory);
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

//updateCurrentCalledAndPushToHistory(groupIdToUpdate, newCurrentCalled);

export function getCurrentCalled(groupId: number) {
	// Find the group in the database
	const group = databases.groups.get("groups").find({ id: groupId });

	// If the group exists, return its currentCalled value
	if (group.value()) {
		return group.get("currentCalled").value();
	} else {
		console.log(`Group ${groupId} not found in the database.`);
		return null;
	}
}
export function getCallHistory(groupId: number) {
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
//console.log(databases.users.get("users").value());
export function addGroup(groupId: number) {
	// Check if the group already exists in the database
	const group = databases.groups.get("groups").find({ id: groupId }).value();
	//console.log(group);
	if (!group) databases.groups.get("groups").push({ id: groupId, currentCalled: null, callHistory: [] }).write();
	return;
	//	console.log(`Group ${groupId} has been added to the database.`);
}

export const addUserHolding = async (userId: number, contractAddress: string): Promise<void> => {
	const user = databases.users.get("users").find({ id: userId }).value();

	if (user) {
		if (!user.holding.includes(contractAddress)) {
			user.holding.push(contractAddress);
			databases.users.get("users").find({ id: userId }).assign(user).write();
		} else {
			//console.log("User already holds this contract address.");
		}
	} else {
		//console.log("User not found.");
	}
};
export async function sendMessageToAllGroups(message: string) {
	const groups = databases.groups.get("groups").value();

	for (const group of groups) {
		const chatId = group.id;
		try {
			await bot.telegram.sendMessage(chatId, message, { parse_mode: "HTML", disable_web_page_preview: true });
			return "ok";
		} catch (error) {
			return null;
		}
	}
}

export const removeUserHolding = async (userId: number, contractAddress: string): Promise<void> => {
	const user = databases.users.get("users").find({ id: userId }).value();

	if (user) {
		const index = user.holding.indexOf(contractAddress);
		if (index !== -1) {
			user.holding.splice(index, 1);
			databases.users.get("users").find({ id: userId }).assign(user).write();
		} else {
			console.log("User does not hold this contract address.");
		}
	} else {
		console.log("User not found.");
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

const addCoinData = (incomingCoinData: CoinDataCollection, db: string) => {
	console.log("addcoindata");
	// @ts-ignore
	databases[db].get("coinsData").push(incomingCoinData).write();
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
const getUserWalletDetails = (userId: number) => {
	const userInDb = databases.users.get("users").find({ id: userId }).value();

	if (userInDb) {
		const { walletAddress, privateKey, mnemonic, holding } = userInDb;
		return { walletAddress, privateKey, mnemonic, holding };
	} else {
		return null; // Or you can throw an error or handle the case as needed
	}
};

//generateTimeAndPriceGraph();
//console.log(`This request was made on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);
//console.log("hey");
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
	const tokens: { data: CoinDataType[] } = await fetchData(chain, null);
	let db: string;

	const priceHistoricalData: { time: number; price: number; name: string; marketCap: number }[] = [];
	// console.log(tokens);
	const token = tokens.data.filter((item) => item.tokenData.name === tokenName);

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
	//myPriceChart.setBackgroundColor("transparent");
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

//this should be hidden

// analyse the data and mention if there is a common market trend that can give informartion in buy or sell.

//main("exit");

export {
	databases,
	writeUser,
	checkUserExists,
	updateWallet,
	isWalletNull,
	getHistoricalDataAndGraph,
	getUserWalletDetails,
};
export default databases;
