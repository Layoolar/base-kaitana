const { ethers } = require("ethers");
require("dotenv").config();

// console.log(`private: ${process.env.PRIVATE_KEY}`);
// console.log(`infura: ${process.env.INFURIA_KEY}`);
// console.log(process.env.INFURIA_KEY);

// return;

//Ethereum network settings
export const buy = async (privateKey, tokenAddress, amountInEth) => {
	const provider = new ethers.providers.JsonRpcProvider(
		`https://base-mainnet.g.alchemy.com/v2/A1lKz4G5uuXNB7q-l2tnKfz6oyqUgFTK`,
	);

	// Contract addresses and ABI

	const uniswapRouterAddress = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // Uniswap v2 Router address for mainnet
	const uniswapRouterABI = [
		"function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
		"function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
	];

	const wallet = new ethers.Wallet(privateKey, provider);
	const uniswapRouterContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterABI, wallet);
	const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
	const path = ["0x4200000000000000000000000000000000000006", tokenAddress];
	//const path = [ethers.constants.AddressZero, tokenAddress]; // Trading ETH for token
	//const amountInEthParsed = ethers.utils.parseEther(amountInEth);
	// Execute the trade
	const tx = await uniswapRouterContract.swapExactETHForTokens(0, path, wallet.address, deadline, {
		value: ethers.utils.parseEther(amountInEth),
		gasLimit: 500000,
	});

	const receipt = await tx.wait();
	console.log("Trade successful!");
	return receipt;
};

// Token addresses
//const tokenAddress = "0x24f303e08227cb3bc8edd607a2f639b86423d5bd"; // Example: Uniswap token address

// // Function to execute the trade
// async function executeTrade(tokenAddress, amountIn, amountOutMin) {
// 	const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
// 	const path = ["0x4200000000000000000000000000000000000006", tokenAddress];
// 	//const path = [ethers.constants.AddressZero, tokenAddress]; // Trading ETH for token

// 	// Execute the trade
// 	const tx = await uniswapRouterContract.swapExactETHForTokens(amountOutMin, path, wallet.address, deadline, {
// 		value: amountIn,
// 		gasLimit: 500000,
// 	});

// 	await tx.wait();
// 	console.log("Trade successful!");
// }

// // Example usage
// const amountInEth = "0.00002"; // Amount of ETH to trade (in Ether)
// const amountOutMin = 0; // Minimum amount of token expected to receive

// executeTrade("0x24f303e08227cb3bc8edd607a2f639b86423d5bd", amountInEth, amountOutMin)
// 	.then(() => {
// 		console.log("Trade executed successfully.");
// 	})
// 	.catch((error) => {
// 		console.error("Error executing trade:", error);
// 	});
// buy(
// 	"0x0ff60d2fbc088535304adb4d3398fa6781c45cfa9eea40445d4751c3d2f8aa81",
// 	"0x24f303e08227cb3bc8edd607a2f639b86423d5bd",
// 	"0.000014050783338270",
// )
// 	.then(() => {
// 		console.log("Trade executed successfully.");
// 	})
// 	.catch((error) => {
// 		console.error("Error executing trade:", error);
// 	});
