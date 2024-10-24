// const AWS = require("aws-sdk");
import AWS from "aws-sdk";

import { MyUser } from "./databases";

AWS.config.update({
	region: "eu-west-2", // e.g., 'us-west-2'
	accessKeyId: process.env.DYNAMO_ACCESS_KEY,
	secretAccessKey: process.env.DYNAMO_SECRET_KEY,
});

const dynamodb = new AWS.DynamoDB();

const tableName = "users";

const params = {
	TableName: tableName,
	KeySchema: [
		{ AttributeName: "id", KeyType: "HASH" }, // Partition key
	],
	AttributeDefinitions: [
		{ AttributeName: "id", AttributeType: "N" }, // N for number
	],
	ProvisionedThroughput: {
		ReadCapacityUnits: 5,
		WriteCapacityUnits: 5,
	},
};

// Function to check if the table exists
const checkTableExists = async () => {
	try {
		const data = await dynamodb.describeTable({ TableName: tableName }).promise();
		console.log(`Table ${tableName} already exists.`);
		return true;
	} catch (err: any) {
		if (err.code === "ResourceNotFoundException") {
			console.log(`Table ${tableName} does not exist.`);
			return false;
		} else {
			throw err;
		}
	}
};

// Function to create the table if it doesn't exist
export const createUserTable = async () => {
	const exists = await checkTableExists();
	if (!exists) {
		try {
			const data = await dynamodb.createTable(params).promise();
			console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
		} catch (err) {
			console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
		}
	}
};

const docClient = new AWS.DynamoDB.DocumentClient();

//const tableName = "MyUserTable";

export const createUser = async (user: MyUser) => {
	const params = {
		TableName: tableName,
		Key: { id: user.id },
	};

	try {
		// Check if the user already exists
		//	checkTableExists();
		const data = await docClient.get(params).promise();
		if (data.Item) {
			console.log("User already exists:", data.Item);
		} else {
			// User does not exist, proceed to create
			const createParams = {
				TableName: tableName,
				Item: user,
			};
			await docClient.put(createParams).promise();
		}
	} catch (err) {
		console.error("Error checking or creating user. Error JSON:", JSON.stringify(err, null, 2));
	}
};

export const getUser = async (userId: number) => {
	const params = {
		TableName: tableName,
		Key: { id: userId },
	};

	try {
		const data = await docClient.get(params).promise();
		//console.log("User retrieved successfully:", data.Item);
		return data.Item as MyUser;
	} catch (err) {
		console.error("Unable to get user. Error JSON:", JSON.stringify(err, null, 2));
		return null;
	}
};

export const getUserLanguage = async (userId: number) => {
	const user = await getUser(userId);

	//	console.log("User language retrieved successfully:", user?.language);
	return user?.language as "english" | "french" | "spanish" | "arabic" | "chinese";
};

export const isWalletAddressNull = async (userId: number) => {
	const user = await getUser(userId);

	if (user) {
		if (user.walletAddress === null) {
			//console.log("User's wallet address is null.");
			return true;
		} else {
			//console.log("User's wallet address is not null:", user.walletAddress);
			return false;
		}
	} else {
		//console.log("User does not exist.");
		return false;
	}
};

export const getUserWalletDetails = async (userId: number) => {
	const user = await getUser(userId);

	if (user) {
		const {
			walletAddress,
			privateKey,
			mnemonic,
			baseholding,
			ethholding,
			solMnemonic,
			solPrivateKey,
			solWalletAddress,
		} = user;
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

export const updateUser = async (
	userId: number,
	updateExpression: string,
	expressionAttributeValues: { [key: string]: any },
) => {
	const params = {
		TableName: tableName,
		Key: { id: userId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "UPDATED_NEW",
	};

	try {
		const data = await docClient.update(params).promise();
		//console.log("User updated successfully:", data);
		return data.Attributes;
	} catch (err) {
		console.error("Unable to update user. Error JSON:", JSON.stringify(err, null, 2));
		return null;
	}
};

export const addUserHolding = async (userId: number, contractAddress: string, chain: string): Promise<void> => {
	const user = await getUser(userId);

	if (user) {
		if (chain === "ethereum") {
			if (!user.ethholding.includes(contractAddress)) {
				user.ethholding.push(contractAddress);
				await updateUser(userId, "SET ethholding = :ethholding", { ":ethholding": user.ethholding });
			}
		} else {
			if (!user.baseholding.includes(contractAddress)) {
				user.baseholding.push(contractAddress);
				await updateUser(userId, "SET baseholding = :baseholding", { ":baseholding": user.baseholding });
			}
		}
	} else {
		console.log("User not found.");
	}
};

export const removeUserHolding = async (userId: number, contractAddress: string, chain: string): Promise<void> => {
	const user = await getUser(userId);

	if (user) {
		if (chain === "ethereum") {
			const index = user.ethholding.indexOf(contractAddress);
			if (index !== -1) {
				user.ethholding.splice(index, 1);
				await updateUser(userId, "SET ethholding = :ethholding", { ":ethholding": user.ethholding });
			} else {
				console.log("User does not hold this contract address.");
			}
		} else {
			const index = user.baseholding.indexOf(contractAddress);
			if (index !== -1) {
				user.baseholding.splice(index, 1);
				await updateUser(userId, "SET baseholding = :baseholding", { ":baseholding": user.baseholding });
			} else {
				console.log("User does not hold this contract address.");
			}
		}
	} else {
		console.log("User not found.");
	}
};

export const updateWallet = async (
	userId: number,
	newWallet: string,
	newPrivateKey: string,
	newMnemonic: string | undefined,
): Promise<boolean> => {
	const user = await getUser(userId);

	if (user) {
		const updateExpression = `SET walletAddress = :walletAddress, privateKey = :privateKey${
			newMnemonic ? ", mnemonic = :mnemonic" : ""
		}`;
		const expressionAttributeValues: { [key: string]: any } = {
			":walletAddress": newWallet,
			":privateKey": newPrivateKey,
		};
		if (newMnemonic) {
			expressionAttributeValues[":mnemonic"] = newMnemonic;
		}

		await updateUser(userId, updateExpression, expressionAttributeValues);
		return true;
	} else {
		console.log("User not found.");
		return false;
	}
};

export const updateSolWallet = async (userId: number, newWallet: string, newPrivateKey: string): Promise<boolean> => {
	const user = await getUser(userId);

	if (user) {
		const updateExpression = "SET solWalletAddress = :solWalletAddress, solPrivateKey = :solPrivateKey";
		const expressionAttributeValues = {
			":solWalletAddress": newWallet,
			":solPrivateKey": newPrivateKey,
		};

		await updateUser(userId, updateExpression, expressionAttributeValues);
		return true;
	} else {
		console.log("User not found.");
		return false;
	}
};
