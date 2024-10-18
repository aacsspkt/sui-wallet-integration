"use client";
import { useEffect, useState } from "react";

import BigNumber from "bignumber.js";

import { SuiClientProvider, useSuiClient } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { getFullnodeUrl } from "@mysten/sui/client";
import { ConnectButton, useWalletKit, WalletKitProvider } from "@mysten/wallet-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
const networks = {
	devnet: { url: getFullnodeUrl("devnet") },
	mainnet: { url: getFullnodeUrl("mainnet") },
	testnet: { url: getFullnodeUrl("testnet") },
};

// Define the USDC token type on Sui testnet
// This is the unique identifier for the USDC token on Sui
const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

export default function Home() {
	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider
				networks={networks}
				defaultNetwork="testnet"
			>
				<WalletKitProvider>
					<App />
				</WalletKitProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	);
}

function App() {
	// Use the wallet kit to get the current account and transaction signing function
	const { currentAccount, signAndExecuteTransactionBlock, status } = useWalletKit();
	// Get the Sui client for interacting with the Sui network
	const suiClient = useSuiClient();
	const [connected, setConnected] = useState(false);
	const [amount, setAmount] = useState("");
	const [recipientAddress, setRecipientAddress] = useState("");
	const [txStatus, setTxStatus] = useState("");

	useEffect(() => {
		setConnected(!!currentAccount);
	}, [currentAccount]);

	const handleSendTokens = async () => {
		if (!currentAccount || !amount || !recipientAddress) {
			setTxStatus("Please connect wallet and fill all fields");
			return;
		}
		try {
			// Fetch USDC coins owned by the current account
			// This uses the SuiClient to get coins of the specified type owned by the current address
			const { data: coins } = await suiClient.getCoins({
				owner: currentAccount.address,
				coinType: USDC_TYPE,
			});
			if (coins.length === 0) {
				setTxStatus("No USDC coins found in your wallet");
				return;
			}
			// Create a new transaction block
			// TransactionBlock is used to construct and execute transactions on Sui
			const tx = new TransactionBlock();

			// Parse amount to its smallest units without decimals
			const parsedAmount = BigNumber(amount)
				.times(10 ** 6)
				.toFixed(0);
			// Split the coin and get a new coin with the specified amount
			// This creates a new coin object with the desired amount to be transferred
			const [coin] = tx.splitCoins(coins[0].coinObjectId, [tx.pure(BigInt(parsedAmount))]);
			// Transfer the split coin to the recipient
			// This adds a transfer operation to the transaction block
			tx.transferObjects([coin], tx.pure(recipientAddress));
			// Sign and execute the transaction block
			// This sends the transaction to the network and waits for it to be executed
			const result = await signAndExecuteTransactionBlock({
				transactionBlock: tx,
			});
			console.log("Transaction result:", result);
			setTxStatus(`Transaction successful. Digest: ${result.digest}`);
		} catch (error) {
			console.error("Error sending tokens:", error);
			setTxStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	};

	return (
		<div className="w-full">
			<header className="w-full h-16 gap-4 flex flex-row justify-between px-4 py-2 shadow mb-8 dark:shadow-gray-400">
				<h1 className="text-xl font-semibold">Sui Test App</h1>
				<ConnectButton className="w-48 h-12  bg-blue-500 !py-1 !px-2 text-center rounded text-white" />
			</header>

			<section>
				<p>
					<span className="">Wallet status:</span> {status}
				</p>

				<div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
					<h1 className="text-4xl font-bold mb-8">Sui USDC Sender (Testnet)</h1>
					{connected && currentAccount && (
						<p className="mt-4">Connected: {currentAccount.address}</p>
					)}
					<div className="mt-8">
						<input
							type="text"
							placeholder="Amount (in USDC)"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className="p-2 border rounded mr-2 text-black"
						/>
						<input
							type="text"
							placeholder="Recipient Address"
							value={recipientAddress}
							onChange={(e) => setRecipientAddress(e.target.value)}
							className="p-2 border rounded mr-2 text-black"
						/>
						<button
							onClick={handleSendTokens}
							disabled={!connected}
							className={`p-2 rounded ${
								connected && amount && recipientAddress
									? "bg-blue-200 text-black hover:bg-blue-300"
									: "bg-gray-300 text-gray-500"
							} transition-colors duration-200`}
						>
							Send USDC
						</button>
					</div>
					{txStatus && <p className="mt-4">{txStatus}</p>}
				</div>
			</section>
		</div>
	);
}
