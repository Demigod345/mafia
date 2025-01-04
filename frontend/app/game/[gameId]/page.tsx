"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Sun, Users, Play } from 'lucide-react';
import { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { VotingPage } from "@/components/VotingPage";
import { Chat } from "@/components/Chat";
import { PlayerList } from "@/components/PlayerList";
import { useGameState } from "@/hooks/useGameState";

export default function GameArea() {
  const { gameId } = useParams();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    gameState,
    players,
    selectedModerator,
    handleStartGame,
    handleModeratorVote,
    handlePlayerVote,
    fetchGameData,
    fetchPlayers,
  } = useGameState();

  useEffect(() => {
    fetchGameData();
    fetchPlayers();
  }, [fetchGameData, fetchPlayers]);

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
      case 6:
        return "Voting";
      default:
        return "Unknown";
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? "dark bg-gray-900 text-white" : "bg-gray-100"
      }`}
    >
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
              {gameState && Number(gameState.current_phase) === 6 ? (
                <VotingPage players={players} onVote={handlePlayerVote} />
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-4">
                    Players ({players.length}/4)
                  </h2>
                  <PlayerList
                    players={players}
                    gamePhase={gameState ? Number(gameState.current_phase) : 0}
                    onModeratorVote={handleModeratorVote}
                    selectedModerator={selectedModerator}
                  />
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
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle>Chat</CardTitle>
            </CardHeader>
            {players.find((p) => p.is_current_player) && (
              <Chat
                name={
                  players.find((p) => p.is_current_player)?.name || "Anonymous"
                }
                gameId={gameId as string}
              />
            )}
          </Card>
        </div>
      </main>
      <Toaster position="bottom-center" />
      <audio ref={audioRef} src="/phase-change.mp3" />
    </div>
  );
}