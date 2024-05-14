//const { ethers } = require("ethers");
require("dotenv").config();

import ethers from "ethers";

const privatekey = "0x0ff60d2fbc088535304adb4d3398fa6781c45cfa9eea40445d4751c3d2f8aa81";
const infurakey = "3534bf3949ca4b1f88e6023ff4ea3223";
// Function to execute a buy trade (ETH to tokens)
async function buy(amountInEth, amountOutMin, tokenAddress, privateKey, infuraKey) {
	const provider = new ethers.providers.JsonRpcProvider(`https://sepolia.infura.io/v3/${infuraKey}`);
	const wallet = new ethers.Wallet(privateKey, provider);

	const uniswapRouterAddress = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"; // Uniswap v2 Router address for mainnet
	const uniswapRouterABI = [
		"function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
		"function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
	];
	const uniswapRouterContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterABI, wallet);

	const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
	const path = [ethers.constants.AddressZero, tokenAddress]; // Trading ETH for token

	// Execute the trade
	const tx = await uniswapRouterContract.swapExactETHForTokens(amountOutMin, path, wallet.address, deadline, {
		value: amountInEth,
		gasLimit: 500000,
	});

	await tx.wait();
	console.log("Buy successful!");
}

// Function to execute a sell trade (tokens to ETH)
async function sell(amountInTokens, amountOutMin, tokenAddress, privateKey, infuraKey) {
	const provider = new ethers.providers.JsonRpcProvider(`https://sepolia.infura.io/v3/${infuraKey}`);
	const wallet = new ethers.Wallet(privateKey, provider);

	const uniswapRouterAddress = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"; // Uniswap v2 Router address for mainnet
	const uniswapRouterABI = [
		"function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
		"function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
	];
	const uniswapRouterContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterABI, wallet);

	const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
	const path = [tokenAddress, ethers.constants.AddressZero]; // Trading tokens for ETH

	// Execute the trade
	const tx = await uniswapRouterContract.swapExactTokensForETH(
		amountInTokens,
		amountOutMin,
		path,
		wallet.address,
		deadline,
		{ gasLimit: 500000 },
	);

	await tx.wait();
	console.log("Sell successful!");
}

// Example usage for buy function
const amountInEth = ethers.utils.parseEther("0.02"); // Amount of ETH to trade for tokens
const amountOutMin = 0; // Minimum amount of token expected to receive
const tokenAddress = "0x2bB4FE2e136A12f9f1B10eb0729B87a7dA7Dee50"; // Token address to buy
const privateKey = process.env.PRIVATE_KEY;
const infuraKey = process.env.INFURIA_KEY;

// buy(amountInEth, amountOutMin, tokenAddress, privateKey, infuraKey)
// 	.then(() => {
// 		console.log("Buy executed successfully.");
// 	})
// 	.catch((error) => {
// 		console.error("Error executing buy:", error);
// 	});

// Example usage for sell function
// const sellAmountInTokens = ethers.utils.parseUnits("100", 18); // Amount of tokens to trade for ETH (in smallest units, e.g., Wei)
// const sellAmountOutMin = 0; // Minimum amount of ETH expected to receive
// const sellTokenAddress = "0x2bB4FE2e136A12f9f1B10eb0729B87a7dA7Dee50"; // Token address to sell

// sell(sellAmountInTokens, sellAmountOutMin, sellTokenAddress, privateKey, infuraKey)
// 	.then(() => {
// 		console.log("Sell executed successfully.");
// 	})
// 	.catch((error) => {
// 		console.error("Error executing sell:", error);
// 	});
