const { ethers } = require("ethers");
require("dotenv").config();

// console.log(`private: ${process.env.PRIVATE_KEY}`);
// console.log(`infura: ${process.env.INFURIA_KEY}`);
// console.log(process.env.INFURIA_KEY);

// return;

export const sell = async (privateKey, tokenAddress, amountInTokens, decimal, userBalance) => {
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
		const tokenABI = [
			"function approve(address spender, uint256 amount) external returns (bool)",
			"function allowance(address owner, address spender) external view returns (uint256)",
		];

		//const tokenABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
		//const tokenAddress = "0x24f303e08227cb3bc8edd607a2f639b86423d5bd";

		const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

		const uniswapRouterContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterABI, wallet);
		const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
		const path = [tokenAddress, "0x4200000000000000000000000000000000000006"];
		//const path = [ethers.constants.AddressZero, tokenAddress]; // Trading ETH for token

		const currentAllowance = await tokenContract.allowance(wallet.address, uniswapRouterAddress);
		if (currentAllowance.lt(amountInTokens)) {
			// Approve Uniswap Router to spend tokens on behalf of the wallet
			const approvalTx = await tokenContract.approve(
				uniswapRouterAddress,
				amountInTokens,
				{ gasLimit: 50000 }, // Adjust gas limit accordingly
			);
			await approvalTx.wait();
			console.log("Approved");
		} else {
			console.log("Already approved");
		}
		// Approve Uniswap Router to spend tokens on behalf of the wallet

		const tx = await uniswapRouterContract.swapExactTokensForETH(
			ethers.utils.parseUnits(amountInTokens, decimal),
			ethers.utils.parseEther("0.000000001"),
			path,
			wallet.address,
			deadline,
			{ gasLimit: 500000 },
		);
		const gasEstimate = await provider.estimateGas(tx);
		const gasPrice = await provider.getGasPrice();
		const maxPriorityFeePerGas = ethers.utils.parseUnits("2", "gwei"); // Example priority fee
		const maxFeePerGas = gasPrice.add(maxPriorityFeePerGas);
		const gasFee = gasEstimate.mul(maxFeePerGas);

		const gas = ethers.utils.formatEther(gasFee);

		if (userBalance <= parseFloat(gas)) {
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

export const sellOnEth = async (privatekeys, tokenAddress, amount, decimals, userBalance) => {
	try {
		const provider = new ethers.providers.JsonRpcProvider(
			`https://mainnet.infura.io/v3/3534bf3949ca4b1f88e6023ff4ea3223`,
		);
		const uniswapRouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap v2 Router address for mainnet
		const uniswapRouterABI = [
			"function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
			"function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
			"function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
		];
		const tokenABI = [
			"function approve(address spender, uint256 amount) external returns (bool)",
			"function allowance(address owner, address spender) external view returns (uint256)",
		];
		const wallet = new ethers.Wallet(privatekeys, provider);
		const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);
		//const decimals = decimals
		const amountInTokens = ethers.utils.parseUnits(amount, decimals);
		const uniswapRouterContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterABI, wallet);

		const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
		const path = [tokenAddress, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"];

		// Check current allowance
		const currentAllowance = await tokenContract.allowance(wallet.address, uniswapRouterAddress);
		if (currentAllowance.lt(amountInTokens)) {
			// Approve Uniswap Router to spend tokens on behalf of the wallet
			const approvalTx = await tokenContract.approve(
				uniswapRouterAddress,
				amountInTokens,
				{ gasLimit: 50000 }, // Adjust gas limit accordingly
			);
			await approvalTx.wait();
			console.log("Approved");
		} else {
			console.log("Already approved");
		}

		const tx = await uniswapRouterContract.swapExactTokensForETH(
			amountInTokens,
			ethers.utils.parseEther("0.000000001"),
			path,
			wallet.address,
			deadline,
			{ gasLimit: 500000 },
		);
		const gasEstimate = await provider.estimateGas(tx);
		const gasPrice = await provider.getGasPrice();
		const maxPriorityFeePerGas = ethers.utils.parseUnits("2", "gwei"); // Example priority fee
		const maxFeePerGas = gasPrice.add(maxPriorityFeePerGas);
		const gasFee = gasEstimate.mul(maxFeePerGas);

		const gas = ethers.utils.formatEther(gasFee);

		if (userBalance <= parseFloat(gas)) {
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
	//throw new Error("The current gas is above our limit, kindly try again after some time");
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
