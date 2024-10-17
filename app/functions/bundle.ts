import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { isError } from "jito-ts/dist/sdk/block-engine/utils";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";

import { Keypair, Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";

export const sendBundle = async (
	sc: SearcherClient,
	transactions: VersionedTransaction[],
	bundleTransactionLimit: number,
	connection: Connection,
	keypair: Keypair,
) => {
	const _tipAccount = (await sc.getTipAccounts())[0];
	const tipAccount = new PublicKey(_tipAccount);

	let isLeaderSlot = false;
	while (!isLeaderSlot) {
		const next_leader = await sc.getNextScheduledLeader();
		const num_slots = next_leader.nextLeaderSlot - next_leader.currentSlot;
		isLeaderSlot = num_slots <= 2;
		console.log(`next jito leader slot in ${num_slots} slots`);
		await new Promise((r) => setTimeout(r, 500));
	}

	const blockHash = await connection.getLatestBlockhash();
	const bundle = new Bundle([], bundleTransactionLimit);

	let maybeBundle = bundle.addTransactions(...transactions);

	if (isError(maybeBundle)) {
		throw maybeBundle;
	}

	maybeBundle = maybeBundle.addTipTx(keypair, 100_000, tipAccount, blockHash.blockhash);

	if (isError(maybeBundle)) {
		throw maybeBundle;
	}

	try {
		const resp = await sc.sendBundle(bundle);
		console.log("resp:", resp);
	} catch (e) {
		// console.error("error sending bundle:", e)
		throw e;
	}
};

export const onBundleResult = (c: SearcherClient) => {
	c.onBundleResult(
		(result: any) => {
			console.log("received bundle result:", result);
		},
		(e: any) => {
			throw e;
		},
	);
};
