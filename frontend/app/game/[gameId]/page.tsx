"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Users, Play } from 'lucide-react';
import { connect } from "get-starknet";
import { Toaster, toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerCard } from "@/components/PlayerCard";
import { VotingPage } from "@/components/VotingPage";
import { Chat } from "@/components/Chat";
import { useGameData } from "@/hooks/useGameData";
import { GamePhase, getGamePhase } from "@/types/game";
import contractData from "@/contract/data.json";

export default function GameArea() {
  const { gameId } = useParams();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [connection, setConnection] = useState(null);
  const [address, setAddress] = useState("");
  const [selectedModerator, setSelectedModerator] = useState(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    gameState,
    players,
    isLoading,
    error,
    refreshData,
    getContract
  } = useGameData(gameId, connection, address);

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

  const handleStartGame = async () => {
    if (players.length >= 4 && connection) {
      await toast.promise(
        (async () => {
          const call = await connection.execute([{
            contractAddress: contractData.contractAddress,
            entrypoint: "start_game",
            calldata: CallData.compile({ game_id: gameId }),
          }]);

          await fetch("/api/events", {
            method: "POST",
            body: JSON.stringify({
              game_id: gameId,
              transaction_hash: call.transaction_hash,
            }),
            headers: { "Content-Type": "application/json" },
          });
        })(),
        {
          loading: "Starting the game...",
          success: "Game started successfully!",
          error: "Failed to start the game. Please try again.",
        }
      );
      await refreshData();
    } else {
      toast.error("Not enough players to start the game or wallet not connected");
    }
  };

  const handleModeratorVote = async (moderatorAddress: string) => {
    if (!connection) {
      toast.error("Please connect your wallet first");
      return;
    }

    setSelectedModerator(moderatorAddress);
    await toast.promise(
      (async () => {
        const call = await connection.execute([{
          contractAddress: contractData.contractAddress,
          entrypoint: "cast_moderator_vote",
          calldata: CallData.compile({
            player: address,
            game_id: gameId,
            candidate: moderatorAddress,
          }),
        }]);

        await fetch("/api/events", {
          method: "POST",
          body: JSON.stringify({
            game_id: gameId,
            transaction_hash: call.transaction_hash,
          }),
          headers: { "Content-Type": "application/json" },
        });
      })(),
      {
        loading: "Submitting your vote...",
        success: "Vote submitted successfully!",
        error: "Failed to submit your vote. Please try again.",
      }
    );
    await refreshData();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-4"
          >
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
              Cali Mafia
            </h1>
            <span className="text-sm px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
              Game ID: {gameId}
            </span>
          </motion.div>
          <div className="flex items-center space-x-4">
            {!connection && (
              <Button
                variant="outline"
                onClick={handleConnectWallet}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-gray-900/50 backdrop-blur-sm border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-emerald-400">
                <Users className="w-6 h-6" />
                <span>
                  {isLoading
                    ? "Loading..."
                    : gameState
                    ? getGamePhase(Number(gameState.current_phase))
                    : "Game Phase Loading..."}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
              ) : error ? (
                <div className="text-red-400 text-center p-4">{error}</div>
              ) : gameState && Number(gameState.current_phase) === GamePhase.DAY ? (
                <VotingPage players={players} onVote={handlePlayerVote} />
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-4 text-gray-300">
                    Players ({players.length}/4)
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <AnimatePresence>
                      {players.map((player) => (
                        <PlayerCard
                          key={player.address}
                          player={player}
                          showVoteButton={gameState?.current_phase === GamePhase.MODERATOR_VOTE}
                          onVote={handleModeratorVote}
                          isVoted={selectedModerator === player.address}
                          disabled={selectedModerator !== null}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                  {gameState?.current_phase === GamePhase.SETUP && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                    >
                      <Button
                        onClick={handleStartGame}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                        disabled={players.length < 4}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Game ({players.length}/4 players)
                      </Button>
                    </motion.div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:row-span-2 bg-gray-900/50 backdrop-blur-sm border-gray-800">
            <CardHeader>
              <CardTitle className="text-emerald-400">Game Chat</CardTitle>
            </CardHeader>
            <Chat
              name={
                players.find((p) => p.is_current_player)?.name || "Anonymous"
              }
            />
          </Card>
        </div>
      </main>
      <Toaster position="bottom-center" />
      <audio ref={audioRef} src="/phase-change.mp3" />
    </div>
  );
}
