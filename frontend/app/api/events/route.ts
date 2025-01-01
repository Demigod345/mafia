// @ts-nocheck

"use server";

import contractData from "@/contract/data.json";
import { NextRequest, NextResponse } from "next/server";
import {
  RpcProvider,
  Contract,
  WalletAccount,
  CallData,
  num,
  shortString,
} from "starknet";
import jwt from "jsonwebtoken";
import { send } from "process";

const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL,
});
let mafiaContract = null;

async function getContract() {
  if (mafiaContract === null) {
    const { abi: contractAbi } = await provider.getClassAt(
      contractData.contractAddress
    );
    if (contractAbi === undefined) {
      throw new Error("No ABI found for the contract.");
    }
    mafiaContract = new Contract(
      contractAbi,
      contractData.contractAddress,
      provider
    );
  }
  return mafiaContract;
}

type Event =
  | { "contracts::MafiaGame::GameCreated": { game_id: bigint } }
  | {
      "contracts::MafiaGame::GameStarted": {
        game_id: bigint;
        player_count: number;
      };
    }
  | {
      "contracts::MafiaGame::PlayerRegistered": {
        game_id: bigint;
        player: bigint;
        name: bigint;
      };
    }
  | {
      "contracts::MafiaGame::ModeratorVoteCast": {
        game_id: bigint;
        voter: bigint;
        candidate: bigint;
        voter_name: bigint;
        candidate_name: bigint;
      };
    }
  | {
      "contracts::MafiaGame::ModeratorChosen": {
        game_id: bigint;
        moderator: bigint;
        name: bigint;
        vote_count: number;
      };
    }
  | {
      "contracts::MafiaGame::RoleCommitmentSubmitted": {
        game_id: bigint;
        player: bigint;
        player_name: bigint;
      };
    }
  | {
      "contracts::MafiaGame::VoteSubmitted": {
        game_id: bigint;
        voter: bigint;
        candidate: bigint;
        voter_name: bigint;
        candidate_name: bigint;
        day: number;
        phase: number;
      };
    }
  | { "contracts::MafiaGame::DayChanged": { game_id: bigint; new_day: number } }
  | {
      "contracts::MafiaGame::RoleRevealed": {
        game_id: bigint;
        player: bigint;
        player_name: bigint;
        role: number;
      };
    }
  | {
      "contracts::MafiaGame::PlayerEliminated": {
        game_id: bigint;
        player: bigint;
        player_name: bigint;
        reason: number;
      };
    }
  | {
      "contracts::MafiaGame::PhaseChanged": {
        game_id: bigint;
        new_phase: number;
      };
    }
  | { "contracts::MafiaGame::GameEnded": { game_id: bigint; winner: number } };

function getPhaseText(phase: number): string {
  switch (phase) {
    case 0:
      return "Game not created";
    case 1:
      return "Game setup";
    case 2:
      return "Moderator vote";
    case 3:
      return "Role assignment";
    case 4:
      return "Night";
    case 5:
      return "Day";
    default:
      return "Unknown";
  }
}

function getMessages(
  events: Event[]
): { text: string; type: "SystemMessage" }[] {
  const messages: { text: string; type: "SystemMessage" }[] = [];

  const shortenAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  try {
    events.forEach((event) => {
      for (const key in event) {
        if ("contracts::MafiaGame::GameCreated" == key) {
          messages.push({
            text: `✨ *A new game has been created!*`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::GameStarted" == key) {
          const { player_count } = event["contracts::MafiaGame::GameStarted"];
          messages.push({
            text: `🎮 *The game has started!* Players joined: _${Number(
              player_count
            )}_.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::PlayerRegistered" == key) {
          const details = event["contracts::MafiaGame::PlayerRegistered"];
          const playerName = shortString.decodeShortString(details.name);
          const playerAddress = shortenAddress(num.toHex(details.player));
          messages.push({
            text: `👤 *Player registered:* _${playerName} (${playerAddress})_ has joined the game.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::ModeratorVoteCast" == key) {
          const details = event["contracts::MafiaGame::ModeratorVoteCast"];
          const voterName = shortString.decodeShortString(details.voter_name);
          const candidateName = shortString.decodeShortString(
            details.candidate_name
          );
          messages.push({
            text: `🗳️ *Vote cast:* _${voterName}_ voted for _${candidateName}_ to be the moderator.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::ModeratorChosen" == key) {
          const details = event["contracts::MafiaGame::ModeratorChosen"];
          const moderatorName = shortString.decodeShortString(details.name);
          messages.push({
            text: `👑 *Moderator chosen:* _${moderatorName}_ with _${Number(
              details.vote_count
            )} votes_.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::RoleCommitmentSubmitted" == key) {
          const details =
            event["contracts::MafiaGame::RoleCommitmentSubmitted"];
          const playerName = shortString.decodeShortString(details.player_name);
          messages.push({
            text: `🔒 *Role commitment submitted:* _${playerName}_ has locked in their role.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::VoteSubmitted" == key) {
          const details = event["contracts::MafiaGame::VoteSubmitted"];
          const voterName = shortString.decodeShortString(details.voter_name);
          const candidateName = shortString.decodeShortString(
            details.candidate_name
          );
          messages.push({
            text: `📮 *Vote submitted:* _${voterName}_ voted for _${candidateName}_ on day ${Number(
              details.day
            )}, phase ${Number(details.phase)}.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::DayChanged" == key) {
          const { new_day } = event["contracts::MafiaGame::DayChanged"];
          messages.push({
            text: `🌅 *A new day begins:* Day _${Number(new_day)}_.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::RoleRevealed" == key) {
          const details = event["contracts::MafiaGame::RoleRevealed"];
          const playerName = shortString.decodeShortString(details.player_name);
          const roleText = Number(details.role) === 0 ? "Villager" : "Mafia";
          messages.push({
            text: `🎭 *Role revealed:* _${playerName}_ was a _${roleText}_.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::PlayerEliminated" == key) {
          const details = event["contracts::MafiaGame::PlayerEliminated"];
          const playerName = shortString.decodeShortString(details.player_name);
          const reasonText =
            Number(details.reason) === 0 ? "voted out" : "killed by Mafia";
          messages.push({
            text: `💀 *Player eliminated:* _${playerName}_ was ${reasonText}.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::PhaseChanged" == key) {
          const { new_phase } = event["contracts::MafiaGame::PhaseChanged"];
          const phaseText = getPhaseText(Number(new_phase));
          messages.push({
            text: `⏳ *Phase changed:* Now it's the _${phaseText} phase_.`,
            type: "SystemMessage",
          });
        } else if ("contracts::MafiaGame::GameEnded" == key) {
          const details = event["contracts::MafiaGame::GameEnded"];
          const winnerText =
            Number(details.winner) === 0 ? "Villagers" : "Mafia";
          messages.push({
            text: `🏆 *Game ended:* _${winnerText}_ win!`,
            type: "SystemMessage",
          });
        }
      }
    });
  } catch (error) {
    console.error("Error parsing event:", error);
  }

  return messages;
}

async function updateConvertion(gameId) {
  try {
    const response = await fetch(
      `https://api.talkjs.com/v1/tQrD36pK/conversations/${gameId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TALK_SECRET_KEY}`,
        },
        body: JSON.stringify(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Conversation updated successfully:", result);
    return result;
  } catch (error) {
    console.error("Error updating conversation:", error);
    throw error;
  }
}

async function sendMessages(messages, gameId) {
  try {
    await updateConvertion(gameId);
    const response = await fetch(
      `https://api.talkjs.com/v1/tQrD36pK/conversations/${gameId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TALK_SECRET_KEY}`,
        },
        body: JSON.stringify(messages),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send messages: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Messages sent successfully:", result);
    return result;
  } catch (error) {
    console.error("Error sending messages:", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log(data);
    // console.log(process.env.TALK_SECRET_KEY);
    // generateToken();
    // sendMessage("Testing to see if this works?", data.game_id);

    const txHash = data.transaction_hash;
    const gameId = data.game_id;
    const txReceipt = await provider.waitForTransaction(txHash);
    const contract = await getContract();
    const events = contract.parseEvents(txReceipt);
    console.log(events);
    const messages = getMessages(events);
    console.log(messages);
    sendMessages(messages, gameId);

    return new Response("Success", {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response("Error: " + error, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
