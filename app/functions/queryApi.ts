const openaiApiKey = "";
import OpenAI from "openai";
import type { ChatCompletionUserMessageParam } from "openai/resources";

export const queryAi = async (text: string): Promise<string> => {
	let aiReply = "";
	await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${openaiApiKey}`,
		},
		body: JSON.stringify({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "user",
					content: text,
				},
			],
			temperature: 0.7,
		}),
	})
		.then((response) => response.json())
		.then((data) => {
			aiReply = data.choices[0].message.content as string;
			// //console.log(aiReply);
			// console.log(data);
			// //console.log(data);
		})
		.catch((error) => {
			console.log("Error:", error);
			return "error";
		});
	return aiReply;
};
const openai = new OpenAI({
	apiKey: openaiApiKey, // This is the default and can be omitted
});

export async function conversation(input: string, chatHistory: string[][]) {
	const userInput = input; // getmessage from user
	try {
		// call the api with userinput
		// @ts-ignore
		const messages: ChatCompletionUserMessageParam[] = chatHistory.map(([role, content]) => ({
			role,
			content,
		}));

		messages.push({ role: "user", content: userInput });
		const chatCompletion = await openai.chat.completions.create({
			messages: messages,
			model: "gpt-3.5-turbo",
			temperature: 0.8,
		});
		const completionMessage = chatCompletion.choices[0].message.content;
		// Goodbye! Feel free to come back if you have any more questions. Have a great day!
		return completionMessage;
		// update history
	} catch (error) {
		console.log(error);
	}
	//	}

	// console.log();
}
