// Access the workerData by requiring it.
//const path = require("path");
//const { parentPort, workerData } = require("worker_threads");
import OpenAI from "openai";
import { parentPort } from "worker_threads";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from "fs";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});
//const { downloadFile, transcribeAudio } = require("./helper");
//const { downloadFile, transcribeAudio } = require(path.join(__dirname, "helper.ts"));
//mport { downloadFile, transcribeAudio } from "./helper.ts";

// Something you shouldn"t run in main thread
// since it will block.
// function fib(n) {
// 	if (n < 2) {
// 		return n;
// 	}
// 	return fib(n - 1) + fib(n - 2);
// }
import axios from "axios";
const getFileInformation = async (fileId, botToken) => {
	try {
		const response = await axios.get(`https://api.telegram.org/bot${botToken}/getFile`, {
			params: { file_id: fileId },
		});
		//console.log(response.data);
		return response.data.result;
	} catch (error) {
		console.error("Error fetching file information:", error.message);
		throw error;
	}
};
const botToken = "6748077007:AAHxMh8OdsrtcrOY9pkGeoc6wFPLO2mCI7s";
export const downloadFile = async (fileId, userId) => {
	const fileinfo = await getFileInformation(fileId, botToken);
	//const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

	const url = "https://api.telegram.org/file/bot6748077007:AAHxMh8OdsrtcrOY9pkGeoc6wFPLO2mCI7s/" + fileinfo.file_path;

	//api.telegram.org/file/bot6748077007:AAHxMh8OdsrtcrOY9pkGeoc6wFPLO2mCI7s/voice/file_181.oga
	console.log(url);

	const response = await axios({
		url,

		method: "GET",

		responseType: "stream",
	});

	const filePath = path.join(__dirname, userId.toString() + "voice_note.ogg");
	const writer = fs.createWriteStream(filePath);

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on("finish", () => resolve(filePath));
		writer.on("error", reject);
	});
};

export const deleteFile = (filePath) => {
	fs.unlink(filePath, (err) => {
		if (err) {
			//console.error("Error deleting file:", err);
		} else {
			//console.log("File deleted successfully");
		}
	});
};

const transcribeAudio = async (filePath) => {
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
		console.error("Error:", error);

		throw error;
	}
};

async function processVoiceMessage(voice, userId) {
	console.log(voice, userId);
	const filePath = await downloadFile(voice.file_id, userId);
	//console.log(filePath);
	const transcription = await transcribeAudio(filePath);
	const output = transcription.replace(/[-.]/g, "");
	//console.log(output);

	deleteFile(filePath);
	return output;
}

// Main thread will pass the data you need
// through this event listener.
parentPort.on("message", async (param) => {
	const result = await processVoiceMessage(param.voice, param.userId);

	// Access the workerData.
	//	console.log("workerData is", workerData);

	// return the result to main thread.
	parentPort.postMessage(result);
});
