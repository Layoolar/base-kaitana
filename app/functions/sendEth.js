import { ethers } from "ethers";

// Function to send ETH
export async function sendEth(senderPrivateKey, recipientAddress, amountInEth) {
	try {
		// Connect to the Ethereum network using your private key
		const provider = new ethers.providers.JsonRpcProvider(
			`https://base-mainnet.g.alchemy.com/v2/A1lKz4G5uuXNB7q-l2tnKfz6oyqUgFTK`,
		);

		const wallet = new ethers.Wallet(senderPrivateKey, provider);

		const nonce = await provider.getTransactionCount(wallet.address, "latest");
		// Convert amount to wei (1 ETH = 10^18 wei)
		const amountInWei = ethers.utils.parseEther(amountInEth);

		// Construct transaction object
		const tx = {
			chainId: 8453,
			nonce: nonce,
			to: recipientAddress,
			value: amountInWei,
			gasPrice: ethers.utils.parseUnits("50", "gwei"),
			gasLimit: 21000,
		};

		// Sign the transaction
		const signedTx = await wallet.signTransaction(tx);

		// Send the signed transaction
		const txResponse = await provider.sendTransaction(signedTx);
		console.log(`Transaction hash: ${txResponse.hash}`);
		console.log(`Transaction sent successfully!`);
		return txResponse;
	} catch (error) {
		console.log("Error sending ETH:", error);
		return null;
	}
}

// Example usage:
// const senderPrivateKey = "YOUR_PRIVATE_KEY";
// const recipientAddress = "RECIPIENT_ADDRESS";
// const amountInEth = "0.1"; // Amount of ETH to send
// sendEth(senderPrivateKey, recipientAddress, amountInEth);
