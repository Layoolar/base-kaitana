const { ethers } = require("ethers");
require("dotenv").config();

// console.log(`private: ${process.env.PRIVATE_KEY}`);
// console.log(`infura: ${process.env.INFURIA_KEY}`);
// console.log(process.env.INFURIA_KEY);

// return;

export const sell = async (privateKey, tokenAddress, amountInTokens, decimal) => {
	try {
		const provider = new ethers.providers.JsonRpcProvider(
			`https://base-mainnet.g.alchemy.com/v2/A1lKz4G5uuXNB7q-l2tnKfz6oyqUgFTK`,
		);

		const wallet = new ethers.Wallet(privateKey, provider);
		// Contract addresses and ABI
		const uniswapRouterAddress = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // Uniswap v2 Router address for mainnet
		const uniswapRouterABI = [
			"function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
			"function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
			"function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
		];

		const tokenABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
		//const tokenAddress = "0x24f303e08227cb3bc8edd607a2f639b86423d5bd";

		const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

		const uniswapRouterContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterABI, wallet);
		const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
		const path = [tokenAddress, "0x4200000000000000000000000000000000000006"];
		//const path = [ethers.constants.AddressZero, tokenAddress]; // Trading ETH for token

		// Approve Uniswap Router to spend tokens on behalf of the wallet
		const approvalTx = await tokenContract.approve(
			uniswapRouterAddress,
			ethers.utils.parseUnits(amountInTokens, decimal),
			{ gasLimit: 50000 }, // Adjust gas limit accordingly
		);
		await approvalTx.wait();

		const tx = await uniswapRouterContract.swapExactTokensForETH(
			ethers.utils.parseUnits(amountInTokens, decimal),
			ethers.utils.parseEther("0.000000001"),
			path,
			wallet.address,
			deadline,
			{ gasLimit: 500000 },
		);

		const receipt = await tx.wait();

		return receipt.transactionHash;
	} catch (error) {
		throw new Error(error.code);
	}
};

export const sellOnEth = async (privateKey, tokenAddress, amountInTokens, decimal) => {
	throw new Error("The current gas is above our limit, kindly try again after some time");
};
// sell(
// 	"0x0ff60d2fbc088535304adb4d3398fa6781c45cfa9eea40445d4751c3d2f8aa81",
// 	"0x24f303e08227cb3bc8edd607a2f639b86423d5bd",
// 	"15000",
// 	9,
// )
// 	.then(() => {
// 		console.log("Trade executed successfully.");
// 	})
// 	.catch((error) => {
// 		console.error("Error executing trade:", error);
// 	});
