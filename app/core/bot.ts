import * as command from "@app/functions/commands";
import * as hears from "@app/functions/hears";
import "dotenv/config";

// index.js (or your application's entry point file)
// Load .env file into process.env

// Now you can start your application logic

/**
 * Start bot
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */

const startt = async () => {
	await command.launch();
	await command.quit();

	await command.start();
	await command.neww();

	await command.menu();

	await command.coinActions();
	await hears.text();
};

startt();
