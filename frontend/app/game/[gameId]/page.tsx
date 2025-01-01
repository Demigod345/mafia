"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Moon, Sun, Users, Play, Check } from 'lucide-react';
import { Chatbox, Session } from "@talkjs/react";
import Talk from "talkjs";
import { useParams } from "next/navigation";
import contractData from "@/contract/data.json";
import {
  RpcProvider,
  Contract,
  WalletAccount,
  CallData,
  num,
  shortString,
} from "starknet";
import { connect } from "get-starknet";
import { Toaster, toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

type PlayerInfo = {
  name: string;
  address: string;
  is_current_player: boolean;
  public_identity_key: string;
  has_voted_moderator: boolean;
  is_moderator: boolean;
  is_active: boolean;
  role_commitment: string;
  revealed_role: number;
  elimination_info: EliminatedPlayerInfo;
};

type EliminatedPlayerInfo = {
  reason: number;
  mafia_remaining: number;
  mafia_1_commitment: string;
  mafia_2_commitment: string;
};

type GameState = {
  created: boolean;
  started: boolean;
  ended: boolean;
  current_phase: number;
  player_count: number;
  current_day: number;
  moderator: string;
  is_moderator_chosen: boolean;
  mafia_count: number;
  villager_count: number;
  moderator_count: number;
  active_mafia_count: number;
  active_villager_count: number;
};

function Chat({ name }: { name: string }) {
  const { gameId } = useParams();
  const syncUser = useCallback(
    () =>
      new Talk.User({
        id: name.toString().toLowerCase(),
        name: name.toString(),
        email: null,
        photoUrl: `https://robohash.org/${name}.png`,
        welcomeMessage: "Hi! Welcome to Mafia!",
      }),
    [name]
  );

  const syncConversation = useCallback(
    (session: Talk.Session) => {
      const conversation = session.getOrCreateConversation(gameId as string);
      conversation.setParticipant(session.me);
      return conversation;
    },
    [gameId]
  );

  return (
    <Session appId="tQrD36pK" syncUser={syncUser}>
      <Chatbox
        syncConversation={syncConversation}
        style={{ height: "500px" }}
      />
    </Session>
  );
}

export default function GameArea() {
  const { gameId } = useParams();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [connection, setConnection] = useState<WalletAccount | null>(null);
  const [address, setAddress] = useState("");
  const [mafiaContract, setMafiaContract] = useState<Contract | null>(null);
  const [selectedModerator, setSelectedModerator] = useState<string | null>(null);

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
          toast.success("Wallet connected successfully!");
        }
      } catch (error) {
        console.error("Error connecting wallet:", error);
        toast.error("Failed to connect wallet. Please try again.");
      }
    };

    handleConnectWallet();

    const fetchData = async () => {
      await fetchGameData();
      await fetchPlayers();
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => clearInterval(interval);
  }, [gameId, address]);

  const fetchGameData = async () => {
    try {
      const contract = await getContract();
      if (contract) {
        const gameStateResponse = await contract.get_game_state(gameId);
        console.log("Game state:", gameStateResponse);
        setGameState(gameStateResponse);
      }
    } catch (error) {
      console.error("Error fetching game data:", error);
    }
  };

  const fetchPlayers = async () => {
    try {
      const contract = await getContract();
      if (contract) {
        const playerAddresses = await contract.get_players(gameId);
        let currentPlayerFound = false;
        const playersInfo = await Promise.all(
          playerAddresses.map(async (playerAddress) => {
            const playerInfo = await contract.get_player_info(gameId, playerAddress);
            playerInfo.address = num.toHex(playerAddress);
            playerInfo.name = shortString.decodeShortString(playerInfo.name);
            if (playerInfo.address.toString().toLowerCase() === address.toString().toLowerCase()) {
              playerInfo.is_current_player = true;
              currentPlayerFound = true;
            }
            return playerInfo;
          })
        );
        setPlayers(playersInfo);
        console.log("Players:", playersInfo);
        if (!currentPlayerFound) {
          toast.error("Current player not found in the game");
        }
      }
    } catch (error) {
      console.error("Error fetching players:", error);
    }
  };

  const getContract = async () => {
    if (mafiaContract != null) {
      return mafiaContract;
    }

    try {
      const { abi: contractAbi } = await provider.getClassAt(contractData.contractAddress);
      if (contractAbi === undefined) {
        throw new Error("No ABI found for the contract.");
      }
      const contract = new Contract(contractAbi, contractData.contractAddress, provider);
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

  const handleStartGame = async () => {
    if (players.length >= 4 && connection) {
      await toast.promise(
        (async () => {
          const call = await connection.execute([
            {
              contractAddress: contractData.contractAddress,
              entrypoint: "start_game",
              calldata: CallData.compile({
                game_id: gameId,
              }),
            },
          ]);
    
          console.log(call);
          await provider.waitForTransaction(call.transaction_hash);
          await fetchGameData();
        })(),
        {
          loading: 'Starting the game...',
          success: 'Game started successfully!',
          error: 'Failed to start the game. Please try again.',
        }
      );
    } else {
      toast.error("Not enough players to start the game or wallet not connected");
    }
  };

  const handleModeratorVote = async (moderatorAddress: string) => {
    if (connection) {
      setSelectedModerator(moderatorAddress);
      await toast.promise(
        (async () => {
          const call = await connection.execute([
            {
              contractAddress: contractData.contractAddress,
              entrypoint: "cast_moderator_vote",
              calldata: CallData.compile({
                player: address,
                game_id: gameId,
                candidate: moderatorAddress,
              }),
            },
          ]);
    
          console.log(call);
          const txReceipt = await provider.waitForTransaction(call.transaction_hash);
          console.log("Transaction receipt:", txReceipt);
          await fetchGameData();
          await fetchPlayers();
        })(),
        {
          loading: 'Submitting your vote...',
          success: 'Vote submitted successfully!',
          error: 'Failed to submit your vote. Please try again.',
        }
      );
    } else {
      toast.error("Wallet not connected. Please connect your wallet to vote.");
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const getGamePhase = (phase: number): string => {
    switch (phase) {
      case 0:
        return "Game not created";
      case 1:
        return "Game Setup";
      case 2:
        return "Moderator Vote";
      case 3:
        return "Role Assignment";
      case 4:
        return "Night Phase";
      case 5:
        return "Day Phase";
      default:
        return "Unknown";
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark bg-gray-900 text-white" : "bg-gray-100"}`}>
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.h1 
            className="text-3xl font-bold"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Mafia Game
          </motion.h1>
          <div className="flex items-center space-x-4">
            <motion.span
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Game ID: {gameId}
            </motion.span>
            <Button variant="outline" size="icon" onClick={toggleDarkMode}>
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-6 h-6" />
                <span>
                  {gameState
                    ? getGamePhase(Number(gameState.current_phase))
                    : "Game Phase Loading..."}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">
                Players ({players.length}/4)
              </h2>
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <AnimatePresence>
                  {players.map((player) => (
                    <motion.div
                      key={player.address}
                      className={`flex items-center space-x-2 p-2 rounded-md ${
                        player.is_current_player
                          ? "bg-blue-100 dark:bg-blue-900"
                          : "bg-gray-100 dark:bg-gray-700"
                      }`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Avatar>
                        <AvatarImage
                          src={`https://robohash.org/${player.name}.png`}
                          alt={player.name}
                        />
                        <AvatarFallback>{player.name[0]}</AvatarFallback>
                      </Avatar>
                      <span>{player.name}</span>
                      {player.is_current_player && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full ml-auto">
                          You
                        </span>
                      )}
                      {gameState && Number(gameState.current_phase) === 2 && !player.is_current_player && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto"
                          onClick={() => handleModeratorVote(player.address)}
                          disabled={selectedModerator !== null}
                        >
                          {selectedModerator === player.address ? <Check className="w-4 h-4" /> : 'Vote'}
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
              {gameState && Number(gameState.current_phase) === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Button
                    onClick={handleStartGame}
                    className="w-full"
                    disabled={players.length < 4}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Game ({players.length}/4 players)
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle>Chat</CardTitle>
            </CardHeader>
            <Chat name={players.find(p => p.is_current_player)?.name || "Anonymous"} />
          </Card>
        </div>
      </main>
      <Toaster position="bottom-center" />
    </div>
  );
}

