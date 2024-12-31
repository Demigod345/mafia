// @ts-nocheck

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Sun, Copy, Users, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { RpcProvider, Contract, WalletAccount, CallData } from "starknet";
import { connect } from "get-starknet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/header";

export default function GameLobby() {
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [isJoinGameOpen, setIsJoinGameOpen] = useState(false);
  const [gameId, setGameId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [connection, setConnection] = useState(null);
  const [address, setAddress] = useState("");
  const [mafiaContract, setMafiaContract] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [calimeroKey, setCalimeroKey] = useState("");
  const [useCustomId, setUseCustomId] = useState(false);
  const router = useRouter();

  const provider = new RpcProvider({
    nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL,
  });

  useEffect(() => {
    const handleConnectWallet = async () => {
      try {
        const selectedWalletSWO = await connect({ modalTheme: "dark" });
        const wallet = await new WalletAccount(
          { nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL },
          selectedWalletSWO
        );

        if (wallet) {
          setConnection(wallet);
          setAddress(wallet.walletProvider.selectedAddress);
        }
      } catch (error) {
        console.error("Error connecting wallet:", error);
      }
    };

    handleConnectWallet();
  }, []);

  const getContract = async () => {
    if (mafiaContract != null) {
      return mafiaContract;
    }

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const { abi: contractAbi } = await provider.getClassAt(contractAddress);
    if (contractAbi === undefined) {
      throw new Error("no abi.");
    }
    const contract = new Contract(contractAbi, contractAddress, provider);
    setMafiaContract(contract);
    return contract;
  };

  const doesGameExist = async (gameId: string) => {
    const contract = await getContract();
    const res = await contract.does_game_exist(gameId);
    return res;
  };

  const joinGame = async (gameId: string, playerName: string) => {
    console.log("Joining game... with address: ", address);
    const call = await connection.execute([
      {
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
        entrypoint: "join_game",
        calldata: CallData.compile({
          player: address,
          game_id: gameId,
          player_name: playerName,
        }),
      },
    ]);

    console.log(call);

    await provider.waitForTransaction(call.transaction_hash);
    router.push(`/${gameId}`);
  };

  const createAndJoinGame = async () => {
    console.log("Creating game... with address: ", address);
    console.log("Game ID: ", gameId);
    console.log("Player Name: ", playerName);
    console.log("Calimero Key: ", calimeroKey);
    console.log(connection)
    // const call = await connection.execute([
    //   {
    //     contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    //     entrypoint: "create_game",
    //     calldata: CallData.compile({
    //       game_id: gameId,
    //     }),
    //   },
    //   {
    //     contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    //     entrypoint: "join_game",
    //     calldata: CallData.compile({
    //       player: address,
    //       game_id: gameId,
    //       player_name: playerName,
    //     }),
    //   },
    // ]);

    // console.log(call);
    // await provider.waitForTransaction(call.transaction_hash);
  };

  const handleCreateGame = async () => {
    if (!playerName) {
      setJoinError("Please enter your name");
      return;
    }

    if (!calimeroKey) {
      setJoinError("Please enter your Calimero public identity key");
      return;
    }

    if (useCustomId && !gameId) {
      setJoinError("Please enter a custom game ID");
      return;
    }

    if (!useCustomId) {
      let newGameId;
      let gameExists = true;
      while (gameExists) {
        newGameId = `game_${Math.random().toString(36).substr(2, 9)}`;
        gameExists = await doesGameExist(newGameId);
      }
      setGameId(newGameId);
    }

    await createAndJoinGame();
    setIsCreateGameOpen(false);
  };

  const handleJoinGame = async () => {
    if (!playerName) {
      setJoinError("Please enter your name");
      return;
    }

    const gameExists = await doesGameExist(gameId);
    if (!gameExists) {
      setJoinError("Game does not exist");
      return;
    }

    await joinGame(gameId, playerName);
    setJoinError("");
    setIsJoinGameOpen(false);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? "dark bg-black text-white" : "bg-white text-black"
      }`}
    >
      <Header address={address} />
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">Game Lobby</h1>
            <Button variant="outline" size="icon" onClick={toggleDarkMode}>
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card
                className={`hover:shadow-lg transition-shadow cursor-pointer ${
                  isDarkMode ? "bg-gray-800 text-white" : ""
                }`}
                onClick={() => setIsCreateGameOpen(true)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Plus className="w-6 h-6 mr-2" />
                    Create New Game
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={isDarkMode ? "text-gray-300" : "text-gray-600"}>
                    Start a new game and invite other players to join.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card
                className={`hover:shadow-lg transition-shadow cursor-pointer ${
                  isDarkMode ? "bg-gray-800 text-white" : ""
                }`}
                onClick={() => setIsJoinGameOpen(true)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-6 h-6 mr-2" />
                    Join Existing Game
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={isDarkMode ? "text-gray-300" : "text-gray-600"}>
                    Join an existing game using a game ID.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        <Dialog open={isCreateGameOpen} onOpenChange={setIsCreateGameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Game</DialogTitle>
              <DialogDescription>
                Enter your name and Calimero public identity key to create a new
                game.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className={`mb-4 ${isDarkMode ? "bg-gray-700 text-white" : ""}`}
            />
            <Input
              value={calimeroKey}
              onChange={(e) => setCalimeroKey(e.target.value)}
              placeholder="Enter your Calimero public identity key"
              className={`mb-4 ${isDarkMode ? "bg-gray-700 text-white" : ""}`}
            />
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="useCustomId"
                checked={useCustomId}
                onCheckedChange={setUseCustomId}
              />
              <Label htmlFor="useCustomId">Use custom game ID</Label>
            </div>

            {useCustomId && (
              <Input
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="Enter custom game ID"
                className={`mb-4 ${isDarkMode ? "bg-gray-700 text-white" : ""}`}
              />
            )}

            {joinError && (
              <p className="text-red-500 text-sm mb-4">{joinError}</p>
            )}
            <DialogFooter>
              <Button onClick={handleCreateGame}>Create Game</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isJoinGameOpen} onOpenChange={setIsJoinGameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join Game</DialogTitle>
              <DialogDescription>
                Enter the game ID, your name, and Calimero public identity key
                to join an existing game.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter game ID"
              className="mb-4"
            />
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="mb-4"
            />
            <Input
              value={calimeroKey}
              onChange={(e) => setCalimeroKey(e.target.value)}
              placeholder="Enter your Calimero public identity key"
              className="mb-4"
            />
            {joinError && (
              <p className="text-red-500 text-sm mb-4">{joinError}</p>
            )}
            <DialogFooter>
              <Button onClick={handleJoinGame}>Join Game</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
