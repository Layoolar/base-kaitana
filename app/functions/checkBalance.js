const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider(
	`https://mainnet.infura.io/v3/3534bf3949ca4b1f88e6023ff4ea3223`,
);

const walletAddress = "0x6B9AC3A905897F153484A801005017f8206F7567"; // Replace with the Ethereum wallet address you want to check
export async function getEtherBalance(walletAddress) {
	try {
		const balance = await provider.getBalance(walletAddress);
		return ethers.utils.formatEther(balance);
	} catch (error) {
		return null;
		//	throw new Error("Error getting Ether balance: " + error.message);
	}
}

// Function to get ERC20 token balance
export async function getTokenBalance(walletAddress, tokenAddress) {
	try {
		const abi = [
			// ERC20 standard ABI
			"function balanceOf(address) view returns (uint)",
			"function decimals() view returns (uint8)", // Adding decimals function
		];

		const tokenContract = new ethers.Contract(tokenAddress, abi, provider);

		const balance = await tokenContract.balanceOf(walletAddress);
		const decimals = await tokenContract.decimals(); // Retrieve decimals

		// Adjust balance using decimals
		const adjustedBalance = balance.div(ethers.BigNumber.from(10).pow(decimals));

		//console.log(adjustedBalance.toString());
		return adjustedBalance.toNumber();
	} catch (error) {
		console.error("Error getting token balance:", error.message);
		return null;
	}
}

// getTokenBalance(walletAddress, "0x24f303e08227cB3bC8EDd607a2F639B86423D5bD")
// 	.then((balance) => {
// 		console.log(balance);
// 	})
// 	.catch((error) => {
// 		console.error(error);
// 	});
