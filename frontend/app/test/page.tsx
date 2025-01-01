/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

"use client";

import React, { useState } from "react";
import { Contact } from "lucide-react";
import { RpcProvider, Contract, CallData, WalletAccount } from "starknet";
import { connect } from "get-starknet";
import { Session, Chatbox } from "@talkjs/react";

const contractAddr =
  "0x01b61cce629fec9b07fbff4f4fc70fb4a77b7489b4bec381451efd9bff5cd6e6";

const WalletCounter = () => {
  const [connection, setConnection] = useState(null);
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(0);
  const [myContract, setMyContract] = useState(null);
  const provider = new RpcProvider({
    nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL,
    // nodeUrl: "http://localhost:5050",
  });

  const getContract = async () => {
    if (myContract != null) {
      return myContract;
    }

    const contractAddress = contractAddr;
    const { abi: contractAbi } = await provider.getClassAt(contractAddress);
    if (contractAbi === undefined) {
      throw new Error("no abi.");
    }
    const contract = new Contract(contractAbi, contractAddress, provider);
    setMyContract(contract);
    return contract;
  };

  const connectWallet = async () => {
    try {
      const selectedWalletSWO = await connect({
        modalMode: "alwaysAsk",
        modalTheme: "dark",
      });
      const wallet = new WalletAccount(
        { nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL },
        selectedWalletSWO
      );

      console.log(wallet);

      if (wallet) {
        setConnection(wallet);
        setAddress(wallet.address);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();

      setConnection(undefined);
      setAddress("");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  const incrementBalance = async () => {
    //   // console.log(wallet);
    //   const contract = getContract();
    //   // contract.connect(wallet);
    //   const myCall = contract.populate("increase_balance", [10]);
    //   const res = await contract.execute(myCall);
    //   await provider.waitForTransaction(res.transaction_hash);
    //   console.log(res);
    //   // setBalance((prev) => prev + 1);
    //   await getBalance();
    // const call = await connection.populate("increase_balance", [10]);
    // console.log(call)
    // const res = await connection.execute(call);
    // await provider.waitForTransaction(res.transaction_hash);
    // console.log(res);

    const call = await connection.execute([
      {
        contractAddress: contractAddr,
        entrypoint: "increase_balance",
        calldata: CallData.compile({
          amount: 10,
        }),
      },
    ]);

    console.log(call);

    await provider.waitForTransaction(call.transaction_hash);
    await getBalance();
  };

  const getBalance = async () => {
    const contract = await getContract();
    console.log(contract);
    const myBalance = await contract.get_balance();
    setBalance(Number(myBalance));
    console.log(myBalance);
    console.log("Balance:", balance);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md space-y-6">
        <h1 className="text-2xl font-bold text-center">
          ArgentX Wallet Counter
        </h1>

        {!connection ? (
          <div>
            <Session appId="tQrD36pK" userId="sample_user_alice">
              <Chatbox
                conversationId="hello"
                style={{ width: "100%", height: "500px" }}
              ></Chatbox>
            </Session>
            <button
              onClick={connectWallet}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Connected:
              {/* {wallet.selectedAddress.slice(0, 6)}... */}
              {/* {wallet.selectedAddress.slice(-4)} */}
            </p>
            <p className="text-xl font-semibold">Balance: {balance}</p>
            <button
              onClick={getBalance}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Get Balance
            </button>

            <button
              onClick={incrementBalance}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              Increment Balance
            </button>
            <button
              onClick={disconnectWallet}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletCounter;
