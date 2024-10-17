import * as solana from "@solana/web3.js";
import bs58 from "bs58";
import { Keypair, PublicKey } from "@solana/web3.js";
import { solToTokenSwap, tokenToSolSwap } from "./newsolana";

// const connection = new solana.Connection(process.env.CONNECT_ENDPOINT, {
// 	wsEndpoint: process.env.WS_ENDPOINT,
// });

// const mintConnection = new solana.Connection(solana.clusterApiUrl("devnet"), {
// 	commitment: "confirmed",
// });

const QUICKNODE_RPC =
	// "https://rpc.hellomoon.io/238422d4-9179-4087-85b3-b07354b6ba9a";
	"https://mainnet.helius-rpc.com/?api-key=7ac71d07-8188-40ac-bacc-d91d36b61b38";
const connection = new solana.Connection(QUICKNODE_RPC, "confirmed");

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createSolWallet = () => {
	const walletKeyPair = solana.Keypair.generate();
	const publicKey = walletKeyPair.publicKey.toString();
	const privateKey = walletKeyPair.secretKey.toString();

	const privateKeyBuffer = Buffer.from(walletKeyPair.secretKey);
	const privateKeyBase58 = bs58.encode(privateKeyBuffer);
	return { privateKeyBase58, publicKey };
};

export const createKeypair = (secretKey: string) => {
	const secretKeyBase = bs58.decode(secretKey);
	const wallet = Keypair.fromSecretKey(secretKeyBase);

	return wallet;
};

export const handleSolForToken = async (privateKey: string, address: string, amount: number) => {
	const keypair = createKeypair(privateKey);
	const response = await solToTokenSwap(connection, keypair, address, amount);

	return response;
};
export const handleTokenForSol = async (privateKey: string, address: string, amount: number) => {
	const keypair = createKeypair(privateKey);
	const response = await tokenToSolSwap(connection, keypair, address, amount);

	return response;
};
