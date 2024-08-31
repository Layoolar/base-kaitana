import AWS from "aws-sdk";
import { TokenData } from "./timePriceData";
import { Log } from "./commands";

// AWS.config.update({
// 	region: "eu-west-2", // Your AWS region
// 	accessKeyId: process.env.DYNAMO_ACCESS_KEY || "", // Your access key
// 	secretAccessKey: process.env.DYNAMO_SECRET_KEY || "", // Your secret key
// });

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();
const logTableName = "Logs";

/**
 * Create the Logs table if it does not already exist.
 */
export const createLogTable = async (): Promise<void> => {
	const params = {
		TableName: logTableName,
		KeySchema: [
			{ AttributeName: "ca", KeyType: "HASH" }, // Partition key for the table
		],
		AttributeDefinitions: [
			{ AttributeName: "ca", AttributeType: "S" },
			{ AttributeName: "postedDate", AttributeType: "S" }, // Attribute for the GSI
		],
		ProvisionedThroughput: {
			ReadCapacityUnits: 5,
			WriteCapacityUnits: 5,
		},
		GlobalSecondaryIndexes: [
			{
				IndexName: "DateIndex",
				KeySchema: [
					{ AttributeName: "postedDate", KeyType: "HASH" }, // Partition key for GSI
				],
				Projection: {
					ProjectionType: "ALL",
				},
				ProvisionedThroughput: {
					ReadCapacityUnits: 5,
					WriteCapacityUnits: 5,
				},
			},
		],
	};

	try {
		await dynamodb.createTable(params).promise();
		console.log("Table created successfully");
	} catch (err: any) {
		if (err.code === "ResourceInUseException") {
			console.log("Table already exists.");
		} else {
			console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
		}
	}
};

/**
 * Update or create a log entry.
 * If the log entry exists, update the queries and cryptoToken.
 * If the log entry does not exist, create a new entry with the current time.
 * @param ca - The unique identifier for the log entry
 * @param cryptoToken - The token data associated with the log entry
 */
export const updateLog = async (ca: string, cryptoToken: TokenData): Promise<void> => {
	const currentTime = new Date().toISOString();

	const params = {
		TableName: logTableName,
		Key: { ca },
		UpdateExpression: `
      SET cryptoToken = :cryptoToken,
          postedDate = :postedDate,
          queries = if_not_exists(queries, :start) + :inc
    `,
		ExpressionAttributeValues: {
			":cryptoToken": cryptoToken,
			":postedDate": currentTime, // Store as ISO string
			":start": 0,
			":inc": 1,
		},
		ReturnValues: "UPDATED_NEW",
	};

	try {
		await docClient.update(params).promise();
	} catch (err) {
		console.error("Unable to update log. Error JSON:", JSON.stringify(err, null, 2));
	}
};

/**
 * Retrieve all logs with the postedDate less than one hour ago.
 * @returns An array of log entries
 */
export const getRecentLogs = async () => {
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // ISO string of one hour ago

	const params = {
		TableName: logTableName,
		IndexName: "DateIndex", // GSI name
		KeyConditionExpression: "postedDate > :oneHourAgo",
		ExpressionAttributeValues: {
			":oneHourAgo": oneHourAgo,
		},
	};

	try {
		const data = await docClient.query(params).promise();

		const logs = data.Items?.map((item) => ({
			ca: item.ca,
			cryptoToken: item.cryptoToken,
			date: item.postedDate,
			queries: item.queries,
		}));

		return logs;
	} catch (err) {
		console.error("Unable to retrieve recent logs. Error JSON:", JSON.stringify(err, null, 2));
		return [];
	}
};

export const getTransactions = async () => {
	const params = {
		TableName: "TransactionTable",
		Key: { transactionId: "1" },
	};

	try {
		const data = await docClient.get(params).promise();
		//console.log("Transaction retrieved successfully:", data.Item);
		return data.Item;
	} catch (err) {
		//console.error("Unable to get transaction. Error JSON:", JSON.stringify(err, null, 2));
		return null;
	}
};

export const updateTransaction = async (ethSpent: number) => {
	const params = {
		TableName: "TransactionTable",
		Key: { transactionId: "1" },
		UpdateExpression:
			"SET numberOfTransactions = if_not_exists(numberOfTransactions, :start) + :num, ethSpent = if_not_exists(ethSpent, :start) + :eth",
		ExpressionAttributeValues: {
			":num": 1,
			":eth": ethSpent,
			":start": 0,
		},
		ReturnValues: "UPDATED_NEW",
	};

	try {
		const data = await docClient.update(params).promise();
	} catch (err) {
		console.error("Unable to update transaction. Error JSON:", JSON.stringify(err, null, 2));
	}
};
