const { ethers } = require("ethers");
require("dotenv").config();

// console.log(`private: ${process.env.PRIVATE_KEY}`);
// console.log(`infura: ${process.env.INFURIA_KEY}`);
// console.log(process.env.INFURIA_KEY);

// return;

//Ethereum network settings
export const buyOnBase = async (privateKey, tokenAddress, amountInEth, userLanguage, userBalance) => {
	try {
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

		const gasEstimate = await provider.estimateGas(tx);
		const gasPrice = await provider.getGasPrice();
		const maxPriorityFeePerGas = ethers.utils.parseUnits("2", "gwei"); // Example priority fee
		const maxFeePerGas = gasPrice.add(maxPriorityFeePerGas);
		const gasFee = gasEstimate.mul(maxFeePerGas);

		const gas = ethers.utils.formatEther(gasFee);
		const totalAmount = amountInEth + parseFloat(gas);

		console.log(totalAmount, userBalance);
		//console.log(totalAmount)

		if (userBalance <= totalAmount) {
			throw new Error(
				{
					english:
						"You have insufficient balance to make this transaction, please try again with a valid amount",
					french: "Vous n'avez pas assez de solde pour effectuer cette transaction, veuillez réessayer avec un montant valide",
					spanish:
						"No tienes suficiente saldo para realizar esta transacción, por favor inténtalo de nuevo con un monto válido",
					arabic: "لا يوجد لديك رصيد كافٍ لإتمام هذه العملية، يرجى المحاولة مرة أخرى بمبلغ صالح",
					chinese: "您的余额不足以完成此交易，请使用有效金额重试",
				}[userLanguage],
			);
		}

		const receipt = await tx.wait();
		//	console.log("Trade successful!");
		return receipt.transactionHash;
	} catch (error) {
		if (error.code.trim().length > 3) {
			throw new Error(error.code);
		} else {
			throw new Error(error.message);
		}
	}
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

export const buyOnEth = async (privateKey, tokenAddress, amountInEth, userLanguage, userBalance) => {
	try {
		const provider = new ethers.providers.JsonRpcProvider(
			`https://mainnet.infura.io/v3/3534bf3949ca4b1f88e6023ff4ea3223`,
		);

		//privateKey = "0x1d3052a35a3773e79152579b5fd805128e394d19dcd09f7af0c055b1065e59d1";

		const uniswapRouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
		const uniswapRouterABI = [
			"function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
			"function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
		];

		const wallet = new ethers.Wallet(privateKey, provider);
		const uniswapRouterContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterABI, wallet);
		const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
		const path = ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", tokenAddress];
		const tx = await uniswapRouterContract.swapExactETHForTokens(0, path, wallet.address, deadline, {
			value: ethers.utils.parseEther(amountInEth),
			gasLimit: 500000,
		});

		const gasEstimate = await provider.estimateGas(tx);
		const gasPrice = await provider.getGasPrice();
		const maxPriorityFeePerGas = ethers.utils.parseUnits("2", "gwei"); // Example priority fee
		const maxFeePerGas = gasPrice.add(maxPriorityFeePerGas);
		const gasFee = gasEstimate.mul(maxFeePerGas);

		const gas = ethers.utils.formatEther(gasFee);
		
		const totalAmount = amountInEth + parseFloat(gas);

	
		if (userBalance <= totalAmount) {
			throw new Error(
				{
					english:
						"You have insufficient balance to make this transaction, please try again with a valid amount",
					french: "Vous n'avez pas assez de solde pour effectuer cette transaction, veuillez réessayer avec un montant valide",
					spanish:
						"No tienes suficiente saldo para realizar esta transacción, por favor inténtalo de nuevo con un monto válido",
					arabic: "لا يوجد لديك رصيد كافٍ لإتمام هذه العملية، يرجى المحاولة مرة أخرى بمبلغ صالح",
					chinese: "您的余额不足以完成此交易，请使用有效金额重试",
				}[userLanguage],
			);
		}

		const receipt = await tx.wait();

		return receipt.transactionHash;
	} catch (error) {
		if (error.code.trim().length > 3) {
			throw new Error(error.code);
		} else {
			throw new Error(error.message);
		}
	}
};
