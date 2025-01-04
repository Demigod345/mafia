// @ts-nocheck

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  RpcProvider,
  Contract,
  WalletAccount,
  CallData,
  num,
  shortString,
} from "starknet";
import { connect } from "get-starknet";
import contractData from "@/contract/data.json";
import { GameState, PlayerInfo } from "@/types/game";

export function useGameState() {
  const { gameId } = useParams();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [connection, setConnection] = useState<WalletAccount | null>(null);
  const [address, setAddress] = useState("");
  const [mafiaContract, setMafiaContract] = useState<Contract | null>(null);
  const [selectedModerator, setSelectedModerator] = useState<string | null>(
    null
  );
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const provider = new RpcProvider({
    nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL,
  });

  const getContract = useCallback(async () => {
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
  }, [mafiaContract, provider]);

  const fetchGameData = useCallback(async () => {
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
  }, [gameId, getContract]);

  const fetchPlayers = useCallback(async () => {
    try {
      const contract = await getContract();
      if (contract) {
        const playerAddresses = await contract.get_players(gameId);
        let currentPlayerFound = false;
        const playersInfo = await Promise.all(
          playerAddresses.map(async (playerAddress) => {
            const playerInfo = await contract.get_player_info(
              gameId,
              playerAddress
            );
            playerInfo.address = num.toHex(playerAddress);
            playerInfo.name = shortString.decodeShortString(playerInfo.name);
            if (
              playerInfo.address.toString().toLowerCase() ===
              address.toString().toLowerCase()
            ) {
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
  }, [gameId, address, getContract]);

  const handleConnectWallet = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    handleConnectWallet();
    fetchGameData();
    fetchPlayers();
  }, [address]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchGameData();
      fetchPlayers();
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchGameData, fetchPlayers]);

  const handleStartGame = useCallback(async () => {
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
          loading: "Starting the game...",
          success: "Game started successfully!",
          error: "Failed to start the game. Please try again.",
        }
      );
      await fetchGameData();
    } else {
      toast.error(
        "Not enough players to start the game or wallet not connected"
      );
    }
  }, [players.length, connection, gameId, fetchGameData]);

  const handleModeratorVote = useCallback(
    async (moderatorAddress: string) => {
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
              toast.error(
                "Failed to update the chat server. Please try again."
              );
            }
          })(),
          {
            loading: "Submitting your vote...",
            success: "Vote submitted successfully!",
            error: "Failed to submit your vote. Please try again.",
          }
        );
        await fetchGameData();
        await fetchPlayers();
      } else {
        toast.error(
          "Wallet not connected. Please connect your wallet to vote."
        );
      }
    },
    [connection, address, gameId, fetchGameData, fetchPlayers]
  );

  const handlePlayerVote = useCallback(
    async (votedPlayerAddress: string) => {
      if (connection) {
        await toast.promise(
          (async () => {
            const call = await connection.execute([
              {
                contractAddress: contractData.contractAddress,
                entrypoint: "cast_vote",
                calldata: CallData.compile({
                  player: address,
                  game_id: gameId,
                  candidate: votedPlayerAddress,
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
              toast.error(
                "Failed to update the chat server. Please try again."
              );
            }
          })(),
          {
            loading: "Submitting your vote...",
            success: "Vote submitted successfully!",
            error: "Failed to submit your vote. Please try again.",
          }
        );
        await fetchGameData();
        await fetchPlayers();
      } else {
        toast.error(
          "Wallet not connected. Please connect your wallet to vote."
        );
      }
    },
    [connection, address, gameId, fetchGameData, fetchPlayers]
  );

  return {
    gameState,
    players,
    selectedModerator,
    handleStartGame,
    handleModeratorVote,
    handlePlayerVote,
    fetchGameData,
    fetchPlayers,
  };
}
