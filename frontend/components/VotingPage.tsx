import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";

type PlayerInfo = {
  name: string;
  address: string;
  is_current_player: boolean;
  is_active: boolean;
};

type VotingPageProps = {
  players: PlayerInfo[];
  onVote: (votedPlayerAddress: string) => Promise<void>;
};

export function VotingPage({ players, onVote }: VotingPageProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const handleVote = async () => {
    if (selectedPlayer) {
      await onVote(selectedPlayer);
      setSelectedPlayer(null);
    } else {
      toast.error("Please select a player to vote for.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vote for a Player</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {players
            .filter((player) => player.is_active && !player.is_current_player)
            .map((player) => (
              <motion.div
                key={player.address}
                className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer ${
                  selectedPlayer === player.address
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
                onClick={() => setSelectedPlayer(player.address)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Avatar>
                  <AvatarImage
                    src={`https://robohash.org/${player.name}.png`}
                    alt={player.name}
                  />
                  <AvatarFallback>{player.name[0]}</AvatarFallback>
                </Avatar>
                <span>{player.name}</span>
              </motion.div>
            ))}
        </div>
        <Button onClick={handleVote} className="w-full" disabled={!selectedPlayer}>
          Cast Vote
        </Button>
      </CardContent>
    </Card>
  );
}

