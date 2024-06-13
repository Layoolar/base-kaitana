import * as solana from "@solana/web3.js";
import bs58 from "bs58";

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
