const fs = require("fs");

function extractIdAndUsername() {
	try {
		// Read the data from the output.json file
		const data = fs.readFileSync("output.json", "utf-8");
		const items = JSON.parse(data);
		//console.log(items);
		// Extract only the id and username fields
		const filteredItems = items.map((item) => ({
			id: item.id.N, // Assuming 'id' is stored as a string in DynamoDB
			username: item.username, // Assuming 'username' is stored as a string in DynamoDB
		}));

		// Save the filtered data to a new JSON file
		fs.writeFileSync("id_username.json", JSON.stringify(filteredItems, null, 2), "utf-8");
		console.log("Filtered data saved to id_username.json");
	} catch (error) {
		console.error("Error processing data:", error);
		throw new Error("Error reading or writing files");
	}
}

extractIdAndUsername();
