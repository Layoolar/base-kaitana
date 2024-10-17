import {
	SystemProgram,
	Connection,
	ParsedAccountData,
	Keypair,
	PublicKey,
	Transaction,
	LAMPORTS_PER_SOL,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import { sendBundle } from "./bundle";
import { searcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import dotenv from "dotenv";
import base58 from "bs58";
import { Wallet } from "@project-serum/anchor";
import axios from "axios";
// import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
dotenv.config();

const blockEngineUrl = process.env.BLOCK_ENGINE_URL || "";

// Function to send sol from one account to another
const sendSolTrasaction = async (connection: Connection, fromKeyPair: Keypair, toKey: PublicKey, numOfSol: number) => {
	const transfer = SystemProgram.transfer({
		fromPubkey: fromKeyPair.publicKey,
		toPubkey: toKey,
		lamports: numOfSol * LAMPORTS_PER_SOL,
	});

	const blockHash = (await connection.getLatestBlockhash("confirmed")).blockhash;

	const messageV0 = new TransactionMessage({
		payerKey: fromKeyPair.publicKey,
		recentBlockhash: blockHash,
		instructions: [transfer],
	}).compileToV0Message();

	const transaction = new VersionedTransaction(messageV0);
	transaction.sign([fromKeyPair]);

	const sc = searcherClient(blockEngineUrl);
	const bundleTransactionLimit = parseInt(process.env.BUNDLE_TRANSACTION_LIMIT || "5");

	console.log("txn signature is: https://solscan.io/tx/", base58.encode(transaction.signatures[0]));

	await sendBundle(sc, [transaction], bundleTransactionLimit, connection, fromKeyPair);
};
// Function to request sol to a particular account: Remember to use clusterURL("devnet") in connection before you request airdrop
const requestAirdrop = async (connection: Connection, publicKey: PublicKey) => {
	await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
};

// Function to send tokens from one account to another

const sendSplToken = async (connection: Connection, fromKeyPair: Keypair, toKey: PublicKey, numOfToken: number) => {
	const splToken = await import("@solana/spl-token");
	// Change mint address to that of your token
	const mintAddress = new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
	const accountInfo = await connection.getParsedAccountInfo(mintAddress);
	const tokenDecimals = (accountInfo.value?.data as ParsedAccountData).parsed.info.decimals as number;
	const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
		connection,
		fromKeyPair,
		mintAddress,
		fromKeyPair.publicKey,
	);
	const destinationAccount = await splToken.getOrCreateAssociatedTokenAccount(
		connection,
		fromKeyPair,
		mintAddress,
		toKey,
	);
	const transfer = splToken.createTransferInstruction(
		tokenAccount.address,
		destinationAccount.address,
		fromKeyPair.publicKey,
		numOfToken * Math.pow(10, tokenDecimals),
		[],
		splToken.TOKEN_PROGRAM_ID,
	);
	const blockHash = (await connection.getLatestBlockhash("confirmed")).blockhash;

	const messageV0 = new TransactionMessage({
		payerKey: fromKeyPair.publicKey,
		recentBlockhash: blockHash,
		instructions: [transfer],
	}).compileToV0Message();

	const transaction = new VersionedTransaction(messageV0);
	transaction.sign([fromKeyPair]);

	const sc = searcherClient(blockEngineUrl);
	const bundleTransactionLimit = parseInt(process.env.BUNDLE_TRANSACTION_LIMIT || "5");
	console.log("txn signature is: https://solscan.io/tx/", base58.encode(transaction.signatures[0]));
	await sendBundle(sc, [transaction], bundleTransactionLimit, connection, fromKeyPair);
};

const jupiterSwap = async (connection: Connection, quoteUrl: string, wallet: Wallet, fromKeyPair: Keypair) => {
	try {
		const quoteResponse = (await axios.get(quoteUrl)).data;

		const swapTransactionResponse = await axios.post(
			`${process.env.JUPITER_SWAP_URL}/swap`,
			{
				quoteResponse,

				userPublicKey: wallet.publicKey.toString(),

				wrapAndUnwrapSol: true,
			},
			{
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
		const swapTransaction = swapTransactionResponse.data.swapTransaction;

		// deserialize the transaction
		const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
		const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
		console.log(transaction);
		const blockHash = (await connection.getLatestBlockhash("confirmed")).blockhash;
		// add blockHash
		transaction.message.recentBlockhash = blockHash;

		// sign the transaction
		transaction.sign([wallet.payer]);

		const sc = searcherClient(blockEngineUrl);
		const bundleTransactionLimit = parseInt(process.env.BUNDLE_TRANSACTION_LIMIT || "5");
		// console.log(
		//     `txn signature is: https://solscan.io/tx/${base58.encode(
		//         transaction.signatures[0]
		//     )}`
		// )

		await sendBundle(sc, [transaction], bundleTransactionLimit, connection, fromKeyPair);
		if (!transaction.signatures[0]) {
			return { success: false };
		}
		return { success: true, hashUrl: `https://solscan.io/tx/${base58.encode(transaction.signatures[0])}` };
	} catch (error) {
		throw error;
	}
};

const tokenToSolSwap = async (
	connection: Connection,
	fromKeyPair: Keypair,
	inputMint: string,
	numberOfTokens: number,
) => {
	try {
		const wallet = new Wallet(fromKeyPair);
		const quoteUrl = `${process.env.JUPITER_SWAP_URL}/quote?inputMint=${inputMint}&outputMint=${
			process.env.SOL_ADDRESS
		}&amount=${Math.round(numberOfTokens * LAMPORTS_PER_SOL)}&slippageBps=50`;

		const res = await jupiterSwap(connection, quoteUrl, wallet, fromKeyPair);
		return res;
	} catch (error) {
		return { success: false };
	}
};

const solToTokenSwap = async (
	connection: Connection,
	fromKeyPair: Keypair,
	outputMint: string,
	numberOfSol: number,
) => {
	try {
		const wallet = new Wallet(fromKeyPair);
		const quoteUrl = `${process.env.JUPITER_SWAP_URL}/quote?inputMint=${
			process.env.SOL_ADDRESS
		}&outputMint=${outputMint}&amount=${Math.round(numberOfSol * LAMPORTS_PER_SOL)}&slippageBps=50`;

		const res = await jupiterSwap(connection, quoteUrl, wallet, fromKeyPair);
		return res;
	} catch (error) {
		console.log(error);
		return { success: false };
	}
};

const mintToken = async (connection: Connection, fromKeyPair: Keypair) => {
	const splToken = await import("@solana/spl-token");
	console.log("this is here");
	const mint = await splToken.createMint(
		connection,
		fromKeyPair,
		fromKeyPair.publicKey,
		null,
		9,
		undefined,
		{},
		splToken.TOKEN_PROGRAM_ID,
	);

	console.log(1);
	const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
		connection,
		fromKeyPair,
		mint,
		fromKeyPair.publicKey,
	);

	console.log(tokenAccount);
	await splToken.mintTo(connection, fromKeyPair, mint, tokenAccount.address, fromKeyPair.publicKey, 1000000000000);
	// await token.mintTo
};

export { sendSolTrasaction, requestAirdrop, sendSplToken, mintToken, tokenToSolSwap, solToTokenSwap };
