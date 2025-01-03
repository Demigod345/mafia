// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

"use client";

import { useState, useEffect } from "react";
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
import { Moon, Sun, Copy, Users, Plus, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { RpcProvider, Contract, WalletAccount, CallData, shortString } from "starknet";
import { connect } from "get-starknet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Toaster, toast } from "react-hot-toast";
import contractData from "@/contract/data.json";
import { twoFeltToString, stringToTwoFelt } from "@/utils/starknet";

export default function GameLobby() {
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [isJoinGameOpen, setIsJoinGameOpen] = useState(false);
  const [gameId, setGameId] = useState("");
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
        await toast.promise(
          (async () => {
            const selectedWalletSWO = await connect({ modalTheme: "dark" });
            const wallet = await new WalletAccount(
              { nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL },
              selectedWalletSWO
            );

            if (wallet) {
              setConnection(wallet);
              setAddress(wallet.walletProvider.selectedAddress);
            }
          })(),
          {
            loading: "Connecting wallet...",
            success: "Wallet connected successfully!",
            error: "Failed to connect wallet. Please try again.",
          }
        );
      } catch (error) {
        console.error("Error connecting wallet:", error);
        toast.error("Failed to connect wallet. Please try again.");
      }
    };

    handleConnectWallet();
  }, []);

  const getContract = async () => {
    if (mafiaContract != null) {
      return mafiaContract;
    }

    try {
      const { abi: contractAbi } = await provider.getClassAt(
        contractData.contractAddress
      );
      if (contractAbi === undefined) {
        throw new Error("No ABI found for the contract.");
      }
      const contract = new Contract(
        contractAbi,
        contractData.contractAddress,
        provider
      );
      setMafiaContract(contract);
      return contract;
    } catch (error) {
      console.error("Error getting contract:", error);
      toast.error(
        "Failed to interact with the game contract. Please try again."
      );
      return null;
    }
  };

  const doesGameExist = async (gameId: string) => {
    const contract = await getContract();
    if (!contract) return false;
    try {
      const res = await contract.does_game_exist(gameId);
      return res;
    } catch (error) {
      console.error("Error checking if game exists:", error);
      toast.error("Failed to check if the game exists. Please try again.");
      return false;
    }
  };

  const joinGame = async (gameId, playerName) => {
    if (!connection) {
      toast.error("Please connect your wallet first.");
      return;
    }

    try {
      console.log("Joining game... with address: ", address);

      await toast.promise(
        (async () => {
          const {x, y} = stringToTwoFelt(calimeroKey);
          const call = await connection.execute([
            {
              contractAddress: contractData.contractAddress,
              entrypoint: "join_game",
              calldata: CallData.compile({
                player: address,
                game_id: gameId,
                name: playerName,
                public_identity_key_1: x,
                public_identity_key_2: y,
              }),
            },
          ]);
          const response = await fetch("/api/events", {
            method: "POST",
            body: JSON.stringify({
              game_id: gameId,
              transaction_hash: call.transaction_hash,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            toast.error("Failed to update the chat server. Please try again.");
          }
        })(),
        {
          loading: "Joining game...",
          success: "Successfully joined the game!",
          error: "Failed to join the game. Please try again.",
        }
      );

      // console.log(call);
      // await provider.waitForTransaction(call.transaction_hash);
      // toast.success("Successfully joined the game!");
      router.push(`/game/${gameId}`);
    } catch (error) {
      console.error("Error joining game:", error);
      toast.error("Failed to join the game. Please try again.");
    }
  };

  const createAndJoinGame = async (_gameId) => {
    if (!connection) {
      toast.error("Please connect your wallet first.");
      return;
    }

    try {
      console.log("Creating game... with address: ", address);
      console.log("Game ID: ", _gameId);
      console.log("Player Name: ", playerName);
      console.log("Calimero Key: ", calimeroKey);

      await toast.promise(
        (async () => {
          const {x, y} = stringToTwoFelt(calimeroKey);
          const call = await connection.execute([
            {
              contractAddress: contractData.contractAddress,
              entrypoint: "create_game",
              calldata: CallData.compile({
                game_id: _gameId,
              }),
            },
            {
              contractAddress: contractData.contractAddress,
              entrypoint: "join_game",
              calldata: CallData.compile({
                player: address,
                game_id: _gameId,
                name: playerName,
                public_identity_key_1: x,
                public_identity_key_2: y,
              }),
            },
          ]);
          const response = await fetch("/api/events", {
            method: "POST",
            body: JSON.stringify({
              game_id: gameId,
              transaction_hash: call.transaction_hash,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            toast.error("Failed to update the chat server. Please try again.");
          }
        })(),
        {
          loading: "Creating and Joining game...",
          success: "Successfully created and joined the game!",
          error: "There is some error. Please try again.",
        }
      );

      router.push(`/game/${_gameId}`);
    } catch (error) {
      console.error("Error creating and joining game:", error);
      toast.error("Failed to create and join the game. Please try again.");
    }
  };

  const handleCreateGame = async () => {
    if (!playerName) {
      toast.error("Please enter your name");
      return;
    }

    if (!calimeroKey) {
      toast.error("Please enter your Calimero public identity key");
      return;
    }

    if (useCustomId && !gameId) {
      toast.error("Please enter a custom game ID");
      return;
    }

    let finalGameId = gameId;
    if (!useCustomId) {
      let newGameId;
      let gameExists = true;
      while (gameExists) {
        newGameId = `game_${Math.random().toString(36).substr(2, 9)}`;
        gameExists = await doesGameExist(newGameId);
      }
      console.log("Generated game ID: ", newGameId);
      finalGameId = newGameId;
    }

    await createAndJoinGame(finalGameId);
    setIsCreateGameOpen(false);
  };

  const handleJoinGame = async () => {
    if (!playerName) {
      toast.error("Please enter your name");
      return;
    }

    if (!calimeroKey) {
      toast.error("Please enter your Calimero public identity key");
      return;
    }

    const gameExists = await doesGameExist(gameId);
    if (!gameExists) {
      toast.error("Game does not exist");
      return;
    }

    await joinGame(gameId, playerName);
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
      <header className="bg-gray-100 dark:bg-gray-800 py-4 px-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mafia Game</h1>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success("Wallet connection feature coming soon!")
            }
          >
            <Wallet className="h-4 w-4 mr-2" />
            {address
              ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`
              : "Connect Wallet"}
          </Button>
          <Button variant="outline" size="icon" onClick={toggleDarkMode}>
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* <h2 className="text-4xl font-bold mb-8 text-center">Game Lobby</h2> */}

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
          <DialogContent className={isDarkMode ? "bg-gray-800 text-white" : ""}>
            <DialogHeader>
              <DialogTitle>Create New Game</DialogTitle>
              <DialogDescription className={isDarkMode ? "text-gray-300" : ""}>
                Enter your details to create a new game.
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
              onChange={(e) => {
                // const value = e.target.value;
                // const arrStr = shortString.splitLongString(value);
                // const arrFelt = arrStr.map((str) => {
                //   return shortString.encodeShortString(str);
                // })
                // console.log("arrStr + " + arrStr);
                // console.log("arrFelt + " + arrFelt);
                // const num1 = arrFelt[0];
                // const num2 = arrFelt[1];

                // const str1 = shortString.decodeShortString(num1);
                // const str2 = shortString.decodeShortString(num2);
                // console.log("joining "+  str1 + str2);
                setCalimeroKey(e.target.value);
              }}
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
            <DialogFooter>
              <Button onClick={handleCreateGame}>Create Game</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isJoinGameOpen} onOpenChange={setIsJoinGameOpen}>
          <DialogContent className={isDarkMode ? "bg-gray-800 text-white" : ""}>
            <DialogHeader>
              <DialogTitle>Join Game</DialogTitle>
              <DialogDescription className={isDarkMode ? "text-gray-300" : ""}>
                Enter the game details to join an existing game.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter game ID"
              className={`mb-4 ${isDarkMode ? "bg-gray-700 text-white" : ""}`}
            />
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
            <DialogFooter>
              <Button onClick={handleJoinGame}>Join Game</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <Toaster position="top-center" />
    </div>
  );
}
