import { useState, useEffect, useCallback } from 'react';
import { Contract, WalletAccount, CallData, RpcProvider, num, shortString } from "starknet";
import { toast } from "react-hot-toast";
import { GameState, PlayerInfo } from '@/types/game';
import contractData from "@/contract/data.json";

export function useGameData(gameId: string, connection: WalletAccount | null, address: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mafiaContract, setMafiaContract] = useState<Contract | null>(null);

  const getContract = useCallback(async () => {
    if (mafiaContract) return mafiaContract;

    try {
      const provider = new RpcProvider({
        nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL,
      });

      const { abi: contractAbi } = await provider.getClassAt(contractData.contractAddress);
      if (!contractAbi) throw new Error("No ABI found for the contract.");

      const contract = new Contract(contractAbi, contractData.contractAddress, provider);
      setMafiaContract(contract);
      return contract;
    } catch (error) {
      console.error("Error getting contract:", error);
      throw new Error("Failed to interact with the game contract");
    }
  }, [mafiaContract]);

  const fetchGameData = useCallback(async () => {
    try {
      const contract = await getContract();
      const gameStateResponse = await contract.get_game_state(gameId);
      setGameState(gameStateResponse);
      return gameStateResponse;
    } catch (error) {
      console.error("Error fetching game data:", error);
      setError("Failed to fetch game data");
      throw error;
    }
  }, [gameId, getContract]);

  const fetchPlayers = useCallback(async () => {
    try {
      const contract = await getContract();
      const playerAddresses = await contract.get_players(gameId);
      
      const playersInfo = await Promise.all(
        playerAddresses.map(async (playerAddress) => {
          const playerInfo = await contract.get_player_info(gameId, playerAddress);
          return {
            ...playerInfo,
            address: num.toHex(playerAddress),
            name: shortString.decodeShortString(playerInfo.name),
            is_current_player: num.toHex(playerAddress).toLowerCase() === address.toLowerCase()
          };
        })
      );
      
      setPlayers(playersInfo);
      return playersInfo;
    } catch (error) {
      console.error("Error fetching players:", error);
      setError("Failed to fetch players");
      throw error;
    }
  }, [gameId, address, getContract]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchGameData(), fetchPlayers()]);
    } catch (error) {
      setError("Failed to refresh game data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchGameData, fetchPlayers]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return {
    gameState,
    players,
    isLoading,
    error,
    refreshData,
    getContract
  };
}

