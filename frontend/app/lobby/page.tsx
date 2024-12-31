// @ts-nocheck

"use client";

import { useEffect, useState } from "react";
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
import { Copy, Users, PlayCircle, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Header, shortenAddress } from "@/components/header";
import { RpcProvider, Contract, WalletAccount, CallData } from "starknet";
import { connect } from "get-starknet";

interface Player {
  id: string;
  address: string;
  name: string;
  calimeroKey: string;
}

export default function GameLobby() {
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [isJoinGameOpen, setIsJoinGameOpen] = useState(false);
  const [gameId, setGameId] = useState("");
  const [currentGame, setCurrentGame] = useState<{
    id: string;
    players: Player[];
  } | null>(null);
  const [joinError, setJoinError] = useState("");
  const [connection, setConnection] = useState(null);
  const [address, setAddress] = useState("");
  const [mafiaContract, setMafiaContract] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [calimeroKey, setCalimeroKey] = useState("");

  const provider = new RpcProvider({
    nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL,
  });

  useEffect(() => {
    const handleConnectWallet = async () => {
      try {
        const selectedWalletSWO = await connect({
          modalTheme: "dark",
        });
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
    // console.log(contract);
    const res = await contract.does_game_exist(gameId);
    return res;
  };

  const joinGame = async (
    gameId: string,
    playerName: string,
    calimeroKey: string
  ) => {
    console.log("Joining game... with address: ", address);
    const call = await connection.execute([
      {
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
        entrypoint: "join_game",
        calldata: CallData.compile({
          player: address,
          game_id: gameId,
          player_name: playerName,
          public_identity_key: calimeroKey,
        }),
      },
    ]);

    console.log(call);

    await provider.waitForTransaction(call.transaction_hash);
  };

  const fetchPlayers = async (gameId: string) => {
    const contract = await getContract();
    const res = await contract.get_players(gameId);
    // for (player in res) {
    //   console.log(player);
    // }
    console.log(res);
    return res;
  };

  const handleCreateGame = async () => {
    if (!playerName || !calimeroKey) {
      setJoinError("Please enter your name and Calimero public identity key");
      return;
    }

    let newGameId;
    let gameExists = true;
    while (gameExists) {
      newGameId = `game_${Math.random().toString(36).substr(2, 9)}`;
      gameExists = await doesGameExist(newGameId);
    }

    joinGame(newGameId, playerName, calimeroKey);

    setCurrentGame({
      id: newGameId,
      players: [
        {
          id: "1",
          address: address,
          name: playerName,
          calimeroKey: calimeroKey,
        },
      ],
    });
    setIsCreateGameOpen(false);
  };

  const handleJoinGame = async () => {
    await fetchPlayers(gameId);
    if (!playerName || !calimeroKey) {
      setJoinError("Please enter your name and Calimero public identity key");
      return;
    }

    // const gameExists = await doesGameExist(gameId)
    // if (!gameExists) {
    //   setJoinError("Game does not exist")
    //   return
    // }

    await joinGame(gameId, playerName, calimeroKey);
    const players = await fetchPlayers(gameId);
    console.log(players);

    if (gameId.trim()) {
      setCurrentGame((prevGame) => ({
        id: gameId,
        players: [
          ...(prevGame?.players || []),
          {
            id: (prevGame?.players.length || 0) + 1 + "",
            address: address,
            name: playerName,
            calimeroKey: calimeroKey,
          },
        ],
      }));
      setJoinError("");
      setIsJoinGameOpen(false);
    } else {
      setJoinError("Please enter a valid game ID");
    }
  };

  const copyGameId = () => {
    if (currentGame?.id) {
      navigator.clipboard.writeText(currentGame.id);
    }
  };

  const canStartGame = currentGame?.players.length >= 4;

  const handleStartGame = () => {
    if (canStartGame) {
      console.log("Starting game...");
      // Add your game start logic here
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header address={address} />

      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {!currentGame ? (
            <>
              <h1 className="text-4xl font-bold mb-8">Game Lobby</h1>

              <div className="grid md:grid-cols-2 gap-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Card
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setIsCreateGameOpen(true)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Plus className="w-6 h-6 mr-2" />
                        Create New Game
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">
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
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setIsJoinGameOpen(true)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Users className="w-6 h-6 mr-2" />
                        Join Existing Game
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">
                        Join an existing game using a game ID.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold">Game Lobby</h1>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Game ID:</span>
                  <code className="bg-gray-100 px-3 py-1 rounded">
                    {currentGame.id}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyGameId}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-6 h-6 mr-2" />
                    Players ({currentGame.players.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentGame.players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-bold">{player.name}</span>
                          <span className="text-gray-500">
                            ({shortenAddress(player.address)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center">
                <p className="text-gray-600">
                  {canStartGame
                    ? "Ready to start the game!"
                    : `Need ${
                        4 - currentGame.players.length
                      } more players to start`}
                </p>
                <Button
                  onClick={handleStartGame}
                  disabled={!canStartGame}
                  className="bg-black text-white hover:bg-gray-800 disabled:bg-gray-300"
                >
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Start Game
                </Button>
              </div>
            </>
          )}
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
              className={`mb-4 ${isDarkMode ? 'bg-gray-700 text-white' : ''}`}
            />
            <Input
              value={calimeroKey}
              onChange={(e) => setCalimeroKey(e.target.value)}
              placeholder="Enter your Calimero public identity key"
              className={`mb-4 ${isDarkMode ? 'bg-gray-700 text-white' : ''}`}
            />
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
