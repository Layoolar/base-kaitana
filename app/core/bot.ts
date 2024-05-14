import * as command from "@app/functions/commands";
import * as hears from "@app/functions/hears";

// index.js (or your application's entry point file)
require("dotenv").config(); // Load .env file into process.env

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
(async () => {
	await command.quit();
	await command.start();
	await command.neww();

	await command.menu();

	await command.coinActions();
	await hears.text();
	await command.launch();
})();
