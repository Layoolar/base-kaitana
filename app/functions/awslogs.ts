import AWS from "aws-sdk";
import { TokenData } from "./timePriceData";
import { Log } from "./commands";

AWS.config.update({
	region: "eu-west-2", // e.g., 'us-west-2'
	accessKeyId: process.env.DYNAMO_ACCESS_KEY,
	secretAccessKey: process.env.DYNAMO_SECRET_KEY,
});

const dynamodb = new AWS.DynamoDB();
const logTableName = "Logs";
const docClient = new AWS.DynamoDB.DocumentClient();

export const createLogTable = async (): Promise<void> => {
	const params = {
		TableName: logTableName,
		KeySchema: [
			{ AttributeName: "ca", KeyType: "HASH" }, // Partition key
			{ AttributeName: "date", KeyType: "RANGE" }, // Sort key
		],
		AttributeDefinitions: [
			{ AttributeName: "ca", AttributeType: "S" },
			{ AttributeName: "date", AttributeType: "S" },
		],
		ProvisionedThroughput: {
			ReadCapacityUnits: 5,
			WriteCapacityUnits: 5,
		},
	};

	try {
		const data = await dynamodb.createTable(params).promise();
		console.log("Table created successfully:", data);
	} catch (err: any) {
		if (err.code === "ResourceInUseException") {
			console.log("Table already exists.");
		} else {
			console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
		}
	}
};

// Call the create table function
createLogTable().then(() => {
	console.log("Create table operation completed.");
});

export const updateLog = async (ca: string, token: TokenData): Promise<void> => {
	const currentTime = new Date().toISOString();

	const params = {
		TableName: logTableName,
		Key: { ca },
		UpdateExpression: `
      SET token = :token,
          date = :date,
          queries = if_not_exists(queries, :start) + :inc
    `,
		ExpressionAttributeValues: {
			":token": token,
			":date": currentTime, // Store as ISO string
			":start": 0,
			":inc": 1,
		},
		ReturnValues: "UPDATED_NEW",
	};

	try {
		const data = await docClient.update(params).promise();
		console.log("Log updated successfully:", data);
	} catch (err) {
		console.error("Unable to update log. Error JSON:", JSON.stringify(err, null, 2));
	}
};

export const getRecentLogs = async () => {
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // ISO string of one hour ago

	const params = {
		TableName: logTableName,
		IndexName: "DateIndex", // GSI name
		KeyConditionExpression: "date > :oneHourAgo",
		ExpressionAttributeValues: {
			":oneHourAgo": oneHourAgo,
		},
	};

	try {
		const data = await docClient.query(params).promise();

		const logs = data.Items?.map((item) => ({
			ca: item.ca,
			token: item.token,
			date: item.date, // Already in ISO string format
			queries: item.queries,
		}));
		console.log("Recent logs retrieved successfully:", logs);
		return logs as Log[];
	} catch (err) {
		console.error("Unable to retrieve recent logs. Error JSON:", JSON.stringify(err, null, 2));
		return [];
	}
};
