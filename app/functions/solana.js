const {
	Connection,
	Keypair,
	VersionedTransaction,
	PublicKey,
	BlockhashWithExpiryBlockHeight,
	TransactionExpiredBlockheightExceededError,
	VersionedTransactionResponse,
} = require("@solana/web3.js");
const fetch = require("cross-fetch");
const { Wallet } = require("@project-serum/anchor");
const bs58 = require("bs58");
const promiseRetry = require("promise-retry");

const solanaAddress = "So11111111111111111111111111111111111111112";

//   const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || '59bidW4dTMQbKLH8CUbK3mgoC4e67ffkefqy7164qsWzGcj2roRbTmkEvdt9MYBW5o7Fs7sFf3YNj5FysSTwwr4u')));

async function getWallet(privateKeys) {
	return new Wallet(Keypair.fromSecretKey(bs58.decode(privateKeys)));
}

async function getDecimalPrecision(mintAddress) {
	return 6;
}
const QUICKNODE_RPC =
	// "https://rpc.hellomoon.io/238422d4-9179-4087-85b3-b07354b6ba9a";
	"https://mainnet.helius-rpc.com/?api-key=7ac71d07-8188-40ac-bacc-d91d36b61b38";
const connection = new Connection(QUICKNODE_RPC, "confirmed");
const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));

async function getQuote(inputMint, outputMint, amount) {
	const response = await fetch(
		`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`,
	);
	return await response.json();
}

async function getSerializedTx(quoteResponse, wallet) {
	const swapTransaction = await fetch("https://quote-api.jup.ag/v6/swap", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			quoteResponse,
			userPublicKey: wallet.publicKey.toString(),
			wrapAndUnwrapSol: true,
		}),
	});

	return await swapTransaction.json(); // Parse the JSON response
}

async function transactionSenderAndConfirmationWaiter({
	connection,
	serializedTransaction,
	blockhashWithExpiryBlockHeight,
}) {
	const txid = await connection.sendRawTransaction(serializedTransaction, { skipPreflight: true });

	const controller = new AbortController();
	const abortSignal = controller.signal;

	const abortableResender = async () => {
		while (true) {
			await wait(2_000);
			if (abortSignal.aborted) return;
			try {
				await connection.sendRawTransaction(serializedTransaction, { skipPreflight: true });
			} catch (e) {
				console.warn(`Failed to resend transaction: ${e}`);
			}
		}
	};

	try {
		abortableResender();
		const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150;

		await Promise.race([
			connection.confirmTransaction(
				{
					...blockhashWithExpiryBlockHeight,
					lastValidBlockHeight,
					signature: txid,
					abortSignal,
				},
				"confirmed",
			),
			new Promise(async (resolve) => {
				while (!abortSignal.aborted) {
					await wait(2_000);
					const tx = await connection.getSignatureStatus(txid, {
						searchTransactionHistory: false,
					});
					if (tx?.value?.confirmationStatus === "confirmed") {
						resolve(tx);
					}
				}
			}),
		]);
	} catch (e) {
		if (e instanceof TransactionExpiredBlockheightExceededError) {
			return null;
		} else {
			throw e;
		}
	} finally {
		controller.abort();
	}

	const response = promiseRetry(
		async (retry) => {
			const response = await connection.getTransaction(txid, {
				commitment: "confirmed",
				maxSupportedTransactionVersion: 0,
			});
			if (!response) {
				retry(response);
			}
			return response;
		},
		{
			retries: 5,
			minTimeout: 1e3,
		},
	);

	return response;
}

async function doSwap(swapTransaction, wallet) {
	const swapTransactionBase64 = swapTransaction.swapTransaction;

	if (!swapTransactionBase64) {
		throw new Error("Invalid swapTransaction object: missing swapTransaction property");
	}

	const swapTransactionBuf = Buffer.from(swapTransactionBase64, "base64");
	const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
	transaction.sign([wallet.payer]);

	const rawTransaction = transaction.serialize();

	const latestBlockhash = await connection.getLatestBlockhash();
	const blockhashWithExpiryBlockHeight = {
		blockhash: latestBlockhash.blockhash,
		lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
	};

	const response = await transactionSenderAndConfirmationWaiter({
		connection,
		serializedTransaction: rawTransaction,
		blockhashWithExpiryBlockHeight,
	});

	if (response) {
		console.log(`Transaction successful: https://solscan.io/tx/${response.transaction.signatures[0]}`);
		const hash = response.transaction.signatures[0];
		return { status: true, hash };
	} else {
		console.error("Transaction failed or expired.");
		return { status: false };
	}
}

export async function buyTokensWithSolana(privateKeys, tokenAddress, amount) {
	try {
		const solValue = amount * 1000000;
		const wallet = await getWallet(privateKeys);
		console.log(wallet);
		const quoteResponse = await getQuote(solanaAddress, tokenAddress, solValue);
		const serializedTx = await getSerializedTx(quoteResponse, wallet);
		const txStatus = await doSwap(serializedTx, wallet);
		return txStatus.hash;
	} catch (error) {
		throw new Error(error.code);
	}
}

export async function sellTokensWithSolana(privateKeys, tokenAddress, amount, decimal) {
	try {
		const solValue = amount * decimal;
		const wallet = await getWallet(privateKeys);
		console.log(wallet);
		const quoteResponse = await getQuote(tokenAddress, solanaAddress, solValue);
		const serializedTx = await getSerializedTx(quoteResponse, wallet);
		const txStatus = await doSwap(serializedTx, wallet);
		return txStatus.hash;
	} catch (error) {
		throw new Error(error.code);
	}
}
