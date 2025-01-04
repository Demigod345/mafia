export type PlayerInfo = {
    name: string;
    address: string;
    is_current_player: boolean;
    public_identity_key_1: string;
    public_identity_key_2: string;
    has_voted_moderator: boolean;
    is_moderator: boolean;
    is_active: boolean;
    role_commitment: string;
    revealed_role: number;
    elimination_info: EliminatedPlayerInfo;
  };
  
  export type EliminatedPlayerInfo = {
    reason: number;
    mafia_remaining: number;
    mafia_1_commitment: string;
    mafia_2_commitment: string;
  };
  
  export type GameState = {
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
  
  export enum GamePhase {
    NOT_CREATED = 0,
    SETUP = 1,
    MODERATOR_VOTE = 2,
    ROLE_ASSIGNMENT = 3,
    NIGHT = 4,
    DAY = 5,
  }
  
  export const getGamePhase = (phase: number): string => {
    switch (phase) {
      case GamePhase.NOT_CREATED:
        return "Game Not Created";
      case GamePhase.SETUP:
        return "Game Setup";
      case GamePhase.MODERATOR_VOTE:
        return "Moderator Vote";
      case GamePhase.ROLE_ASSIGNMENT:
        return "Role Assignment";
      case GamePhase.NIGHT:
        return "Night";
      case GamePhase.DAY:
        return "Day";
      default:
        return "Unknown";
    }
  };
  
  