import { motion } from "framer-motion";
import { Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PlayerInfo } from "@/types/game";

interface PlayerCardProps {
  player: PlayerInfo;
  showVoteButton?: boolean;
  onVote?: (address: string) => void;
  isVoted?: boolean;
  disabled?: boolean;
}

export function PlayerCard({
  player,
  showVoteButton,
  onVote,
  isVoted,
  disabled
}: PlayerCardProps) {
  return (
    <motion.div
      className={`flex items-center space-x-2 p-4 rounded-lg backdrop-blur-sm border border-opacity-20 ${
        player.is_current_player
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-gray-900/50 border-gray-700"
      }`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
    >
      <Avatar className="h-10 w-10 border-2 border-emerald-500/30">
        <AvatarImage src={`https://robohash.org/${player.name}.png`} alt={player.name} />
        <AvatarFallback>{player.name[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-200">{player.name}</p>
        {player.is_current_player && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
            You
          </span>
        )}
      </div>
      {showVoteButton && onVote && !player.is_current_player && (
        <Button
          size="sm"
          variant={isVoted ? "secondary" : "outline"}
          onClick={() => onVote(player.address)}
          disabled={disabled || isVoted}
          className="ml-auto transition-all duration-200 hover:bg-emerald-500/20 hover:text-emerald-400"
        >
          {isVoted ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            "Vote"
          )}
        </Button>
      )}
    </motion.div>
  );
}

