// Access the workerData by requiring it.
//const path = require("path");
//const { parentPort, workerData } = require("worker_threads");

import { parentPort } from "worker_threads";
import path from "path";
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
export const downloadFile = async (fileId, userId) => {
	const file = await bot.telegram.getFileLink(fileId);
	//const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
	const url = file.href;
	

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
