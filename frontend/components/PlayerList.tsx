// @ts-nocheck

import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check } from 'lucide-react';

// type PlayerListProps = {
//   players: PlayerInfo[];
//   gamePhase: number;
//   onModeratorVote: (address: string) => void;
//   selectedModerator: string | null;
// };

export function PlayerList({ players, gamePhase, onModeratorVote, selectedModerator }) {
  return (
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
            {gamePhase === 2 && !player.is_current_player && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => onModeratorVote(player.address)}
                disabled={selectedModerator !== null}
              >
                {selectedModerator === player.address ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "Vote"
                )}
              </Button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

