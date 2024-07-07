import AWS from "aws-sdk";
import { Group } from "./databases";
//import { DynamoDB } from "@aws-sdk/client-dynamodb";

AWS.config.update({
	region: "eu-west-2", // e.g., 'us-west-2'
	accessKeyId: process.env.DYNAMO_ACCESS_KEY,
	secretAccessKey: process.env.DYNAMO_SECRET_KEY,
});

const dynamodb = new AWS.DynamoDB();
const groupTableName = "Groups";

export const createGroupTable = async (): Promise<void> => {
	const params = {
		TableName: groupTableName,
		KeySchema: [
			{ AttributeName: "id", KeyType: "HASH" }, // Partition key
		],
		AttributeDefinitions: [{ AttributeName: "id", AttributeType: "N" }],
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

const docClient = new AWS.DynamoDB.DocumentClient();

export const addGroup = async (group: Group) => {
	const params = {
		TableName: groupTableName,
		Item: group,
		ConditionExpression: "attribute_not_exists(id)", // Ensure the group doesn't already exist
	};

	try {
		await docClient.put(params).promise();
		console.log("Group added successfully");
	} catch (err: any) {
		if (err.code === "ConditionalCheckFailedException") {
			console.log("Group already exists");
		} else {
			console.error("Unable to add group. Error JSON:", JSON.stringify(err, null, 2));
		}
	}
};

export const updateGroup = async (
	groupId: number,
	updateExpression: string,
	expressionAttributeValues: { [key: string]: any },
): Promise<void> => {
	const params = {
		TableName: groupTableName,
		Key: { id: groupId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "UPDATED_NEW",
	};

	try {
		const data = await docClient.update(params).promise();
		console.log("Group updated successfully:", data);
	} catch (err) {
		console.error("Unable to update group. Error JSON:", JSON.stringify(err, null, 2));
	}
};

export const getGroup = async (groupId: number): Promise<Group | null> => {
	const params = {
		TableName: groupTableName,
		Key: { id: groupId },
	};

	try {
		const data = await docClient.get(params).promise();
		console.log("Group retrieved successfully:", data.Item);
		return data.Item as Group;
	} catch (err) {
		console.error("Unable to get group. Error JSON:", JSON.stringify(err, null, 2));
		return null;
	}
};

export const updateCurrentCalledAndCallHistory = async (groupId: number, newCurrentCalled: string): Promise<void> => {
	// Retrieve the current group data
	const getParams = {
		TableName: groupTableName,
		Key: { id: groupId },
	};

	try {
		const data = await docClient.get(getParams).promise();
		const group = data.Item;

		if (!group) {
			console.log(`Group with ID ${groupId} not found.`);
			return;
		}

		// Check if the newCurrentCalled is already in the callHistory array
		if (!group.callHistory.includes(newCurrentCalled)) {
			group.callHistory.push(newCurrentCalled);
		}

		// Update the currentCalled and callHistory attributes
		const updateParams = {
			TableName: groupTableName,
			Key: { id: groupId },
			UpdateExpression: "set currentCalled = :currentCalled, callHistory = :callHistory",
			ExpressionAttributeValues: {
				":currentCalled": newCurrentCalled,
				":callHistory": group.callHistory,
			},
		};

		await docClient.update(updateParams).promise();
		console.log(`Group with ID ${groupId} updated successfully.`);
	} catch (err) {
		console.error(`Unable to update group. Error JSON:`, JSON.stringify(err, null, 2));
	}
};
export const getCurrentCalled = async (groupId: number): Promise<string | null> => {
	const params = {
		TableName: groupTableName,
		Key: { id: groupId },
		ProjectionExpression: "currentCalled",
	};

	try {
		const data = await docClient.get(params).promise();
		if (data.Item) {
			console.log("currentCalled retrieved successfully:", data.Item.currentCalled);
			return data.Item.currentCalled;
		} else {
			console.log("Group not found.");
			return null;
		}
	} catch (err) {
		console.error("Unable to get currentCalled. Error JSON:", JSON.stringify(err, null, 2));
		return null;
	}
};
