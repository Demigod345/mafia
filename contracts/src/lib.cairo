use core::starknet::ContractAddress;

#[derive(Copy, Drop, Serde, starknet::Store)]
struct PlayerInfo {
    name: felt252,
    address: ContractAddress,
    public_identity_key_1: felt252,
    public_identity_key_2: felt252,
    has_voted_moderator: bool,
    is_moderator: bool,
    is_active: bool,
    role_commitment: felt252,
    revealed_role: u32,
    elimination_info: EliminatedPlayerInfo,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
struct EliminatedPlayerInfo {
    reason: u32,
    mafia_remaining: u32,
    mafia_1_commitment: felt252,
    mafia_2_commitment: felt252,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
struct GameState {
    created: bool,
    started: bool,
    ended: bool,
    current_phase: u32,
    player_count: u32,
    current_day: u32,
    moderator: ContractAddress,
    is_moderator_chosen: bool,
    mafia_count: u32,
    villager_count: u32,
    moderator_count: u32,
    active_mafia_count: u32,
    active_villager_count: u32,
}

const PHASE_GAME_NOT_CREATED: u32 = 0;
const PHASE_GAME_SETUP: u32 = 1;
const PHASE_MODERATOR_VOTE: u32 = 2;
const PHASE_ROLE_ASSIGNMENT: u32 = 3;
const PHASE_NIGHT: u32 = 4;
const PHASE_DAY: u32 = 5;

const ROLE_UNASSIGNED: u32 = 0;
const ROLE_VILLAGER: u32 = 1;
const ROLE_MAFIA: u32 = 2;
const ROLE_MODERATOR: u32 = 3;

const REASON_UNDEFINED: u32 = 0;
const REASON_VOTED_OUT_BY_VILLAGERS: u32 = 1;
const REASON_ELIMINATED_BY_MAFIA: u32 = 2;

const WINNER_UNDEFINED: u32 = 0;
const WINNER_VILLAGERS: u32 = 1;
const WINNER_MAFIA: u32 = 2;

#[starknet::interface]
trait IMafiaGame<TContractState> {
    fn create_game(ref self: TContractState, game_id: felt252);
    fn join_game(
        ref self: TContractState,
        player: ContractAddress,
        game_id: felt252,
        name: felt252,
        public_identity_key_1: felt252,
        public_identity_key_2: felt252,
    );
    fn start_game(ref self: TContractState, game_id: felt252);
    fn cast_moderator_vote(
        ref self: TContractState,
        player: ContractAddress,
        game_id: felt252,
        candidate: ContractAddress,
    );
    fn finalize_moderator_selection(ref self: TContractState, game_id: felt252);
    fn submit_role_commitments(
        ref self: TContractState,
        game_id: felt252,
        players: Array<ContractAddress>,
        commitments: Array<felt252>,
        mafia_count: u32,
        villager_count: u32,
    );
    fn eliminate_player_by_mafia(
        ref self: TContractState,
        game_id: felt252,
        player: ContractAddress,
        mafia_remaining: u32,
        mafia_1_commitment: felt252,
        mafia_2_commitment: felt252,
    );
    fn vote(
        ref self: TContractState,
        player: ContractAddress,
        game_id: felt252,
        day_id: u32,
        candidate: ContractAddress,
    );
    fn end_day(ref self: TContractState, game_id: felt252, day_id: u32);
    fn reveal_role(
        ref self: TContractState,
        game_id: felt252,
        player: ContractAddress,
        role: u32,
        nonce: felt252,
    );
    fn get_game_state(self: @TContractState, game_id: felt252) -> GameState;
    fn get_players(self: @TContractState, game_id: felt252) -> Array<ContractAddress>;
    fn get_player_info(
        self: @TContractState, game_id: felt252, player: ContractAddress,
    ) -> PlayerInfo;
    fn get_role_commitment_hash(
        self: @TContractState, game_id: felt252, player: ContractAddress, role: u32, nonce: felt252,
    ) -> felt252;
    fn get_mafia_commitment_hash(
        self: @TContractState,
        game_id: felt252,
        mafia: ContractAddress,
        player: ContractAddress,
        nonce: felt252,
    ) -> felt252;
    fn check_winner(self: @TContractState, game_id: felt252) -> u32;
    fn check_all_active_players_day_voted(
        self: @TContractState, game_id: felt252, day_id: u32,
    ) -> bool;
    fn check_all_players_mod_voted(self: @TContractState, game_id: felt252) -> bool;
    fn check_all_players_reveal_roles(self: @TContractState, game_id: felt252) -> bool;
    fn verify_mafia_eliminations(
        self: @TContractState,
        game_id: felt252,
        mafia1: ContractAddress,
        nonce1: felt252,
        mafia2: ContractAddress,
        noncd2: felt252,
    ) -> bool;
    fn does_game_exist(self: @TContractState, game_id: felt252) -> bool;
}

#[starknet::contract]
mod MafiaGame {
    use starknet::event::EventEmitter;
    use super::IMafiaGame;
    use core::starknet::{ContractAddress, contract_address_const};
    use core::starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, Map};
    use core::array::ArrayTrait;
    use core::pedersen::pedersen;


    #[storage]
    struct Storage {
        games: Map<felt252, super::GameState>,
        game_players: Map<(felt252, ContractAddress), super::PlayerInfo>,
        game_player_addresses: Map<(felt252, u32), ContractAddress>,
        game_moderator_vote_counts: Map<(felt252, ContractAddress), u32>,
        game_day_votes: Map<(felt252, u32, ContractAddress), ContractAddress>,
        game_day_vote_counts: Map<(felt252, u32, ContractAddress), u32>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GameCreated: GameCreated,
        GameStarted: GameStarted,
        PlayerRegistered: PlayerRegistered,
        ModeratorVoteCast: ModeratorVoteCast,
        ModeratorChosen: ModeratorChosen,
        RoleCommitmentSubmitted: RoleCommitmentSubmitted,
        VoteSubmitted: VoteSubmitted,
        RoleRevealed: RoleRevealed,
        PlayerEliminated: PlayerEliminated,
        PhaseChanged: PhaseChanged,
        DayChanged: DayChanged,
        GameEnded: GameEnded,
    }

    #[derive(Drop, starknet::Event)]
    struct GameCreated {
        game_id: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct GameStarted {
        game_id: felt252,
        player_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct PlayerRegistered {
        game_id: felt252,
        player: ContractAddress,
        name: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ModeratorVoteCast {
        game_id: felt252,
        voter: ContractAddress,
        candidate: ContractAddress,
        voter_name: felt252,
        candidate_name: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ModeratorChosen {
        game_id: felt252,
        moderator: ContractAddress,
        name: felt252,
        vote_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct RoleCommitmentSubmitted {
        game_id: felt252,
        player: ContractAddress,
        player_name: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct VoteSubmitted {
        game_id: felt252,
        voter: ContractAddress,
        candidate: ContractAddress,
        voter_name: felt252,
        candidate_name: felt252,
        day: u32,
        phase: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct DayChanged {
        game_id: felt252,
        new_day: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct RoleRevealed {
        game_id: felt252,
        player: ContractAddress,
        player_name: felt252,
        role: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct PlayerEliminated {
        game_id: felt252,
        player: ContractAddress,
        player_name: felt252,
        reason: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct PhaseChanged {
        game_id: felt252,
        new_phase: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct GameEnded {
        game_id: felt252,
        winner: u32 // 0: Villagers, 1: Mafia
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MafiaGameImpl of super::IMafiaGame<ContractState> {
        fn create_game(ref self: ContractState, game_id: felt252) {
            assert(!self._does_game_exist(game_id), 'Game already exists');
            let game_state = super::GameState {
                created: true,
                started: false,
                ended: false,
                current_phase: super::PHASE_GAME_SETUP,
                player_count: 0,
                current_day: 0,
                moderator: contract_address_const::<0>(),
                is_moderator_chosen: false,
                mafia_count: 0,
                villager_count: 0,
                moderator_count: 0,
                active_mafia_count: 0,
                active_villager_count: 0,
            };
            self.games.write(game_id, game_state);
            self.emit(GameCreated { game_id });
        }

        fn join_game(
            ref self: ContractState,
            player: ContractAddress,
            game_id: felt252,
            name: felt252,
            public_identity_key_1: felt252,
            public_identity_key_2: felt252,
        ) {
            assert(self._does_game_exist(game_id), 'Game does not exist');
            let mut game_state = self._get_game(game_id);
            assert(!game_state.started, 'Game already started');

            let caller = player.clone();
            let existing_player = self.game_players.read((game_id, caller));
            assert(existing_player.address == contract_address_const::<0>(), 'Already joined');

            let player_info = super::PlayerInfo {
                name,
                address: caller,
                public_identity_key_1: public_identity_key_1,
                public_identity_key_2: public_identity_key_2,
                has_voted_moderator: false,
                is_moderator: false,
                is_active: true,
                role_commitment: 0,
                revealed_role: super::ROLE_UNASSIGNED,
                elimination_info: super::EliminatedPlayerInfo {
                    reason: super::REASON_UNDEFINED,
                    mafia_remaining: 0,
                    mafia_1_commitment: 0,
                    mafia_2_commitment: 0,
                },
            };

            self.game_players.write((game_id, caller), player_info);
            self.game_player_addresses.write((game_id, game_state.player_count), caller);

            game_state.player_count += 1;
            self.games.write(game_id, game_state);

            self.emit(PlayerRegistered { game_id, player: caller, name });
        }

        fn start_game(ref self: ContractState, game_id: felt252) {
            let mut game_state = self._get_game(game_id);
            assert(!game_state.started, 'Game already started');
            assert(game_state.player_count >= 4, 'Not enough players');
            assert(game_state.current_phase == super::PHASE_GAME_SETUP, 'Game not in setup phase');

            game_state.started = true;
            game_state.current_phase = super::PHASE_MODERATOR_VOTE; // PHASE_MODERATOR_VOTE phase
            self.games.write(game_id, game_state);

            self.emit(GameStarted { game_id, player_count: game_state.player_count });
            self.emit(PhaseChanged { game_id, new_phase: super::PHASE_MODERATOR_VOTE });
        }

        fn get_players(self: @ContractState, game_id: felt252) -> Array<ContractAddress> {
            let game_state = self._get_game(game_id);
            let mut players = ArrayTrait::new(); // Create empty array
            let mut i: u32 = 0;

            loop {
                if i >= game_state.player_count {
                    break;
                }

                let player = self.game_player_addresses.read((game_id, i));
                players.append(player); // Use append instead of push
                i += 1;
            };

            players
        }

        fn get_player_info(
            self: @ContractState, game_id: felt252, player: ContractAddress,
        ) -> super::PlayerInfo {
            self.game_players.read((game_id, player))
        }

        fn cast_moderator_vote(
            ref self: ContractState,
            player: ContractAddress,
            game_id: felt252,
            candidate: ContractAddress,
        ) {
            let caller = player.clone();
            let game_state = self._get_game(game_id);
            assert(game_state.started, 'Game not started');
            assert(!game_state.ended, 'Game ended');
            assert(
                game_state.current_phase == super::PHASE_MODERATOR_VOTE,
                'Not moderator voting phase',
            );

            let mut voter = self.game_players.read((game_id, caller));
            assert(voter.address != contract_address_const::<0>(), 'Invalid player');
            assert(!voter.has_voted_moderator, 'Already voted');

            let candidate_player = self.game_players.read((game_id, candidate));
            assert(candidate_player.address != contract_address_const::<0>(), 'Invalid candidate');

            voter.has_voted_moderator = true;

            self.game_players.write((game_id, caller), voter);
            self
                .game_moderator_vote_counts
                .write(
                    (game_id, candidate),
                    self.game_moderator_vote_counts.read((game_id, candidate)) + 1,
                );

            self
                .emit(
                    ModeratorVoteCast {
                        game_id,
                        voter: caller,
                        candidate,
                        voter_name: voter.name,
                        candidate_name: candidate_player.name,
                    },
                );

            if self.check_all_players_mod_voted(game_id) {
                self.finalize_moderator_selection(game_id);
            }
        }

        fn finalize_moderator_selection(ref self: ContractState, game_id: felt252) {
            let mut game_state = self._get_game(game_id);
            assert(game_state.started, 'Game not started');
            assert(!game_state.ended, 'Game ended');
            assert(
                game_state.current_phase == super::PHASE_MODERATOR_VOTE,
                'Not moderator voting phase',
            );
            assert(!game_state.is_moderator_chosen, 'Moderator already chosen');
            assert(self.check_all_players_mod_voted(game_id), 'Not all players have voted');
            let chosen_moderator = self._get_winning_moderator(game_id);
            let mut moderator_info = self.game_players.read((game_id, chosen_moderator));

            moderator_info.is_moderator = true;
            moderator_info.revealed_role = super::ROLE_MODERATOR;
            game_state.moderator = chosen_moderator;
            game_state.is_moderator_chosen = true;
            game_state.moderator_count = 1;
            game_state
                .current_phase =
                    super::PHASE_ROLE_ASSIGNMENT; // Move to PHASE_ROLE_ASSIGNMENT phase
            self.games.write(game_id, game_state);
            self.game_players.write((game_id, chosen_moderator), moderator_info);
            self
                .emit(
                    ModeratorChosen {
                        game_id,
                        moderator: chosen_moderator,
                        name: moderator_info.name,
                        vote_count: self
                            .game_moderator_vote_counts
                            .read((game_id, chosen_moderator)),
                    },
                );
            self.emit(PhaseChanged { game_id, new_phase: super::PHASE_ROLE_ASSIGNMENT });
        }

        fn check_all_players_mod_voted(self: @ContractState, game_id: felt252) -> bool {
            let game_state = self._get_game(game_id);
            let mut i: u32 = 0;
            let mut all_players_have_voted: bool = true;

            loop {
                if i >= game_state.player_count {
                    break;
                }

                let player = self.game_player_addresses.read((game_id, i));
                let player_info = self.game_players.read((game_id, player));

                if !player_info.has_voted_moderator {
                    all_players_have_voted = false;
                    break;
                }

                i += 1;
            };

            all_players_have_voted
        }

        fn check_all_active_players_day_voted(
            self: @ContractState, game_id: felt252, day_id: u32,
        ) -> bool {
            let game_state = self._get_game(game_id);
            let mut i: u32 = 0;
            let mut all_players_have_voted: bool = true;

            loop {
                if i >= game_state.player_count {
                    break;
                }

                let player = self.game_player_addresses.read((game_id, i));
                let player_info = self.game_players.read((game_id, player));

                if player_info.is_active && !player_info.is_moderator {
                    let candidate = self.game_day_votes.read((game_id, day_id, player));
                    if candidate == contract_address_const::<0>() {
                        all_players_have_voted = false;
                        break;
                    }
                }

                i += 1;
            };

            all_players_have_voted
        }

        fn check_all_players_reveal_roles(self: @ContractState, game_id: felt252) -> bool {
            let game_state = self._get_game(game_id);
            let mut i: u32 = 0;
            let mut all_players_have_revealed: bool = true;

            loop {
                if i >= game_state.player_count {
                    break;
                }

                let player = self.game_player_addresses.read((game_id, i));
                let player_info = self.game_players.read((game_id, player));

                if player_info.revealed_role == super::ROLE_UNASSIGNED {
                    all_players_have_revealed = false;
                    break;
                }

                i += 1;
            };

            all_players_have_revealed
        }

        fn get_game_state(self: @ContractState, game_id: felt252) -> super::GameState {
            self._get_game(game_id)
        }

        fn submit_role_commitments(
            ref self: ContractState,
            game_id: felt252,
            players: Array<ContractAddress>,
            commitments: Array<felt252>,
            mafia_count: u32,
            villager_count: u32,
        ) {
            let mut game_state = self._get_game(game_id);
            assert(game_state.started, 'Game not started');
            assert(!game_state.ended, 'Game ended');
            assert(
                game_state.current_phase == super::PHASE_ROLE_ASSIGNMENT,
                'Not role assignment phase',
            );
            assert(
                mafia_count
                    + villager_count
                    + game_state.moderator_count == game_state.player_count,
                'Invalid role count',
            );
            assert(mafia_count < villager_count, 'Too many mafia players');
            assert(mafia_count >= 1, 'Need at least one mafia');

            let mut i: u32 = 0;
            let players_len = players.len();
            assert(players_len == commitments.len(), 'Array length mismatch');
            assert(
                players_len + game_state.moderator_count == game_state.player_count,
                'Invalid player count',
            );

            game_state.mafia_count = mafia_count;
            game_state.villager_count = villager_count;
            game_state.active_mafia_count = mafia_count;
            game_state.active_villager_count = villager_count;

            loop {
                if i >= players_len {
                    break;
                }

                let player = *players.at(i);
                let commitment = *commitments.at(i);

                let mut player_info = self.game_players.read((game_id, player));
                assert(player_info.address != contract_address_const::<0>(), 'Invalid player');

                player_info.role_commitment = commitment;
                self.game_players.write((game_id, player), player_info);
                self
                    .emit(
                        RoleCommitmentSubmitted { game_id, player, player_name: player_info.name },
                    );

                i += 1;
            };

            game_state.current_phase = super::PHASE_NIGHT; // Move to PHASE_NIGHT phase
            self.games.write(game_id, game_state);
            self.emit(PhaseChanged { game_id, new_phase: super::PHASE_NIGHT });
        }

        fn reveal_role(
            ref self: ContractState,
            game_id: felt252,
            player: ContractAddress,
            role: u32,
            nonce: felt252,
        ) {
            let mut game_state = self._get_game(game_id);
            let mut player_info = self.game_players.read((game_id, player));
            assert(game_state.started, 'Game not started');
            assert(!game_state.ended, 'Game ended');

            assert(
                game_state.current_phase == super::PHASE_NIGHT
                    || game_state.current_phase == super::PHASE_DAY,
                'Not night or vote phase',
            );
            // Check valid role
            assert(role == super::ROLE_VILLAGER || role == super::ROLE_MAFIA, 'Invalid role');
            assert(player_info.revealed_role == super::ROLE_UNASSIGNED, 'Role already revealed');
            assert(!player_info.is_active, 'Player not eliminated');
            // Verify commitment
            let commitment = player_info.role_commitment;
            let calculated_commitment = pedersen(
                pedersen(player.into(), role.into()), pedersen(game_id, nonce),
            );
            assert(commitment == calculated_commitment, 'Invalid commitment');

            player_info.revealed_role = role;
            if role == super::ROLE_MAFIA {
                game_state.active_mafia_count -= 1;
            } else {
                game_state.active_villager_count -= 1;
            }

            let winner = self._check_winner(game_state);
            if winner != super::WINNER_UNDEFINED {
                game_state.ended = true;
                self.emit(GameEnded { game_id, winner });
            }

            self.game_players.write((game_id, player), player_info);
            self.games.write(game_id, game_state);
            self.emit(RoleRevealed { game_id, player, player_name: player_info.name, role });
        }

        fn vote(
            ref self: ContractState,
            player: ContractAddress,
            game_id: felt252,
            day_id: u32,
            candidate: ContractAddress,
        ) {
            let caller = player.clone();
            let game_state = self._get_game(game_id);
            assert(game_state.started, 'Game not started');
            assert(!game_state.ended, 'Game ended');
            assert(game_state.current_phase == super::PHASE_DAY, 'Not voting phase');
            assert(day_id == game_state.current_day, 'Invalid day');

            let existing_vote = self.game_day_votes.read((game_id, day_id, caller));
            assert(existing_vote == contract_address_const::<0>(), 'Already voted');

            let voter = self.game_players.read((game_id, caller));
            assert(voter.address != contract_address_const::<0>(), 'Invalid player');
            assert(voter.is_active, 'Player not active');

            let candidate_info = self.game_players.read((game_id, candidate));
            assert(candidate_info.address != contract_address_const::<0>(), 'Invalid candidate');
            assert(candidate_info.is_active, 'Votee not active');

            self.game_day_votes.write((game_id, day_id, caller), candidate);
            self
                .game_day_vote_counts
                .write(
                    (game_id, day_id, candidate),
                    self.game_day_vote_counts.read((game_id, day_id, candidate)) + 1,
                );
            self
                .emit(
                    VoteSubmitted {
                        game_id,
                        voter: caller,
                        candidate,
                        voter_name: voter.name,
                        candidate_name: candidate_info.name,
                        day: day_id,
                        phase: super::PHASE_DAY,
                    },
                );

            if self.check_all_active_players_day_voted(game_id, day_id) {
                self.end_day(game_id, day_id);
            }
        }

        fn end_day(ref self: ContractState, game_id: felt252, day_id: u32) {
            let mut game_state = self._get_game(game_id);
            assert(game_state.started, 'Game not started');
            assert(!game_state.ended, 'Game ended');
            assert(game_state.current_phase == super::PHASE_DAY, 'Not voting phase');
            assert(day_id == game_state.current_day, 'Invalid day');
            assert(
                self.check_all_active_players_day_voted(game_id, day_id),
                'Not all players have voted',
            );

            let mut highest_votes: u32 = 0;
            let mut highest_voted_player = contract_address_const::<0>();

            let mut i: u32 = 0;
            loop {
                if i >= game_state.player_count {
                    break;
                }

                let player = self.game_player_addresses.read((game_id, i));
                let votes = self.game_day_vote_counts.read((game_id, day_id, player));

                if votes > highest_votes {
                    highest_votes = votes;
                    highest_voted_player = player;
                }

                i += 1;
            };

            let mut highest_voted_player_info = self
                .game_players
                .read((game_id, highest_voted_player));
            highest_voted_player_info.is_active = false;
            highest_voted_player_info
                .elimination_info =
                    super::EliminatedPlayerInfo {
                        reason: super::REASON_VOTED_OUT_BY_VILLAGERS,
                        mafia_remaining: game_state.active_mafia_count,
                        mafia_1_commitment: 0,
                        mafia_2_commitment: 0,
                    };

            self.game_players.write((game_id, highest_voted_player), highest_voted_player_info);
            game_state.current_phase = super::PHASE_NIGHT; // Move to PHASE_NIGHT phase
            game_state.current_day += 1;
            self.games.write(game_id, game_state);
            self
                .emit(
                    PlayerEliminated {
                        game_id,
                        player: highest_voted_player,
                        player_name: highest_voted_player_info.name,
                        reason: super::REASON_VOTED_OUT_BY_VILLAGERS,
                    },
                );
            self.emit(PhaseChanged { game_id, new_phase: super::PHASE_NIGHT });
            self.emit(DayChanged { game_id, new_day: game_state.current_day });
        }

        fn eliminate_player_by_mafia(
            ref self: ContractState,
            game_id: felt252,
            player: ContractAddress,
            mafia_remaining: u32,
            mafia_1_commitment: felt252,
            mafia_2_commitment: felt252,
        ) {
            let mut game_state = self._get_game(game_id);
            let mut player_info = self.game_players.read((game_id, player));
            assert(game_state.started, 'Game not started');
            assert(!game_state.ended, 'Game ended');
            assert(game_state.current_phase == super::PHASE_NIGHT, 'Not Night phase');
            assert(player_info.is_active, 'Player not active');
            assert(mafia_remaining == game_state.active_mafia_count, 'Invalid mafia count');

            player_info.is_active = false;
            player_info
                .elimination_info =
                    super::EliminatedPlayerInfo {
                        reason: super::REASON_ELIMINATED_BY_MAFIA,
                        mafia_remaining,
                        mafia_1_commitment,
                        mafia_2_commitment,
                    };

            game_state.current_phase = super::PHASE_DAY; // Move to PHASE_DAY phase

            self.game_players.write((game_id, player), player_info);
            self.games.write(game_id, game_state);
            self
                .emit(
                    PlayerEliminated {
                        game_id,
                        player,
                        player_name: player_info.name,
                        reason: super::REASON_ELIMINATED_BY_MAFIA,
                    },
                );
        }

        fn get_role_commitment_hash(
            self: @ContractState,
            game_id: felt252,
            player: ContractAddress,
            role: u32,
            nonce: felt252,
        ) -> felt252 {
            pedersen(pedersen(player.into(), role.into()), pedersen(game_id, nonce))
        }

        fn get_mafia_commitment_hash(
            self: @ContractState,
            game_id: felt252,
            mafia: ContractAddress,
            player: ContractAddress,
            nonce: felt252,
        ) -> felt252 {
            pedersen(pedersen(mafia.into(), player.into()), pedersen(game_id, nonce))
        }

        fn verify_mafia_eliminations(
            self: @ContractState,
            game_id: felt252,
            mafia1: ContractAddress,
            nonce1: felt252,
            mafia2: ContractAddress,
            noncd2: felt252,
        ) -> bool {
            let game_state = self._get_game(game_id);
            assert(self.check_all_players_reveal_roles(game_id), 'Not all players revealed roles');
            let mut i: u32 = 0;

            let mut mafia_elimination_verified = true;
            loop {
                if i >= game_state.player_count {
                    break;
                }

                let player = self.game_player_addresses.read((game_id, i));
                let player_info = self.game_players.read((game_id, player));
                let player_elimination_info = player_info.elimination_info;
                if player_elimination_info.reason == super::REASON_ELIMINATED_BY_MAFIA {
                    let commitment_hash1 = self
                        .get_mafia_commitment_hash(game_id, mafia1, player, nonce1);
                    let commitment_hash2 = self
                        .get_mafia_commitment_hash(game_id, mafia2, player, noncd2);

                    let choice1 = player_elimination_info.mafia_1_commitment == commitment_hash1
                        && player_elimination_info.mafia_2_commitment == commitment_hash2;
                    let choice2 = player_elimination_info.mafia_1_commitment == commitment_hash2
                        && player_elimination_info.mafia_2_commitment == commitment_hash1;

                    if !(choice1 || choice2) {
                        mafia_elimination_verified = false;
                    }
                }

                i += 1;
            };

            mafia_elimination_verified
        }

        fn check_winner(self: @ContractState, game_id: felt252) -> u32 {
            let game_state = self._get_game(game_id);
            if game_state.active_mafia_count == 0 {
                super::WINNER_VILLAGERS
            } else if game_state.active_mafia_count >= game_state.active_villager_count {
                super::WINNER_MAFIA
            } else {
                super::WINNER_UNDEFINED
            }
        }

        fn does_game_exist(self: @ContractState, game_id: felt252) -> bool {
            self._does_game_exist(game_id)
        }
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn _get_winning_moderator(ref self: ContractState, game_id: felt252) -> ContractAddress {
            let mut highest_votes: u32 = 0;
            let mut winner = starknet::contract_address_const::<0>();

            let game = self.games.read(game_id);
            let mut i: u32 = 0;

            loop {
                if i >= game.player_count {
                    break;
                }

                let player_address = self.game_player_addresses.read((game_id, i));
                let votes = self.game_moderator_vote_counts.read((game_id, player_address));

                if votes > highest_votes {
                    highest_votes = votes;
                    winner = player_address;
                }

                i += 1;
            };

            assert(winner != starknet::contract_address_const::<0>(), 'No votes cast');
            winner
        }

        fn _does_game_exist(self: @ContractState, game_id: felt252) -> bool {
            let game_state = self.games.read(game_id);
            game_state.created
        }

        fn _get_game(self: @ContractState, game_id: felt252) -> super::GameState {
            let game_state = self.games.read(game_id);
            game_state
        }

        fn _check_winner(self: @ContractState, game_state: super::GameState) -> u32 {
            if game_state.active_mafia_count == 0 {
                super::WINNER_VILLAGERS
            } else if game_state.active_mafia_count > game_state.active_villager_count {
                super::WINNER_MAFIA
            } else {
                super::WINNER_UNDEFINED
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use core::starknet::contract_address_const;
    use super::MafiaGame;
    use starknet::ContractAddress;
    use super::IMafiaGame;

    // Test Constants
    const GAME_ID: felt252 = 'test_game';

    // Test Players
    fn setup_players() -> (
        ContractAddress,
        ContractAddress,
        ContractAddress,
        ContractAddress,
        ContractAddress,
        ContractAddress,
        ContractAddress,
        ContractAddress,
    ) {
        let player1 = contract_address_const::<1>();
        let player2 = contract_address_const::<2>();
        let player3 = contract_address_const::<3>();
        let player4 = contract_address_const::<4>();
        let player5 = contract_address_const::<5>();
        let player6 = contract_address_const::<6>();
        let player7 = contract_address_const::<7>();
        let player8 = contract_address_const::<8>();
        (player1, player2, player3, player4, player5, player6, player7, player8)
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_create_game() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();

        // When
        state.create_game(GAME_ID);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.created == true, 'Game should be created');
        assert(game_state.started == false, 'Game should not be started');
        assert(game_state.player_count == 0, 'Player count should be 0');
    }

    #[test]
    #[available_gas(2000000000)]
    #[should_panic(expected: ('Game already exists',))]
    fn test_create_duplicate_game() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        state.create_game(GAME_ID);

        // When/Then
        state.create_game(GAME_ID); // Should panic
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_join_game() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, _, _, _, _, _, _, _) = setup_players();
        state.create_game(GAME_ID);

        // When
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.player_count == 1, 'Player count should be 1');

        let player_info = state.get_player_info(GAME_ID, player1);
        assert(player_info.name == 'Alice', 'Player name should match');
        assert(
            player_info.public_identity_key_1 == 123 && player_info.public_identity_key_2 == 123,
            'Public key should match',
        );
    }

    #[test]
    #[available_gas(2000000000)]
    #[should_panic(expected: ('Already joined',))]
    fn test_join_game_twice() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, _, _, _, _, _, _, _) = setup_players();
        state.create_game(GAME_ID);

        // When
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123); // Should panic
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_start_game() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, _, _, _, _) = setup_players();
        state.create_game(GAME_ID);

        // Join 4 players
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);

        // When
        state.start_game(GAME_ID);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.started == true, 'Game should be started');
        assert(
            game_state.current_phase == super::PHASE_MODERATOR_VOTE, 'Not in moderator vote phase',
        );
    }

    #[test]
    #[available_gas(2000000000)]
    #[should_panic(expected: ('Not enough players',))]
    fn test_start_game_not_enough_players() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, _, _, _, _, _, _) = setup_players();
        state.create_game(GAME_ID);

        // Join only 2 players
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);

        // When/Then
        state.start_game(GAME_ID); // Should panic
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_moderator_voting() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, _, _, _, _) = setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.start_game(GAME_ID);

        // When - all vote for player1
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player2);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.moderator == player1, 'Player1 should be moderator');
        assert(game_state.is_moderator_chosen == true, 'Moderator should be chosen');
        assert(
            game_state.current_phase == super::PHASE_ROLE_ASSIGNMENT,
            'Should be in role assignment',
        );
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_get_players() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, _, _, _, _, _, _) = setup_players();

        // Setup game with 2 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);

        // When
        let players = state.get_players(GAME_ID);

        // Then
        assert(players.len() == 2, 'Should have 2 players');
        assert(*players.at(0) == player1, 'First player should be player1');
        assert(*players.at(1) == player2, 'Second player should be player2');
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_get_player_info() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, _, _, _, _, _, _, _) = setup_players();

        // Setup game with 1 player
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);

        // When
        let player_info = state.get_player_info(GAME_ID, player1);

        // Then
        assert(player_info.name == 'Alice', 'Player name should match');
        assert(
            player_info.public_identity_key_1 == 123 && player_info.public_identity_key_2 == 123,
            'Public key should match',
        );
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_submit_role_commitments() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, _, _, _, _) = setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.start_game(GAME_ID);
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player2);

        let commitment_player2 = state
            .get_role_commitment_hash(GAME_ID, player2, super::ROLE_MAFIA, 123);
        let commitment_player3 = state
            .get_role_commitment_hash(GAME_ID, player3, super::ROLE_VILLAGER, 456);
        let commitment_player4 = state
            .get_role_commitment_hash(GAME_ID, player4, super::ROLE_VILLAGER, 789);

        let mut players = ArrayTrait::new();
        players.append(player2);
        players.append(player3);
        players.append(player4);

        let mut commitments = ArrayTrait::new();
        commitments.append(commitment_player2);
        commitments.append(commitment_player3);
        commitments.append(commitment_player4);
        // When
        state
            .submit_role_commitments(
                GAME_ID, // [player2, player3, player4],
                // [commitment_player2, commitment_player3, commitment_player4],
                players, commitments, 1, 2,
            );

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.mafia_count == 1, 'Mafia count should be 1');
        assert(game_state.villager_count == 2, 'Villager count should be 2');
        assert(game_state.active_mafia_count == 1, 'Active mafia count should be 1');
        assert(game_state.active_villager_count == 2, 'Active villager should be 2');
        assert(game_state.current_phase == super::PHASE_NIGHT, 'Should be in night phase');
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_reveal_role() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, _, _, _, _) = setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.start_game(GAME_ID);
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player2);

        let mut players = ArrayTrait::new();
        players.append(player2);
        players.append(player3);
        players.append(player4);

        let mut commitments = ArrayTrait::new();
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player2, super::ROLE_MAFIA, 123));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player3, super::ROLE_VILLAGER, 456));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player4, super::ROLE_VILLAGER, 789));

        state.submit_role_commitments(GAME_ID, players, commitments, 1, 2);

        state.eliminate_player_by_mafia(GAME_ID, player3, 1, 123, 456);

        // When
        state.reveal_role(GAME_ID, player3, super::ROLE_VILLAGER, 456);
        // state.reveal_role(GAME_ID, player3, super::ROLE_VILLAGER, 456);
        // state.reveal_role(GAME_ID, player4, super::ROLE_VILLAGER, 789);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.active_mafia_count == 1, 'Active mafia count should be 0');
        assert(game_state.active_villager_count == 1, 'Active villager should be 1');
        assert(game_state.current_phase == super::PHASE_DAY, 'Should be in day phase');
    }

    #[test]
    #[available_gas(2000000000)]
    #[should_panic(expected: ('Invalid commitment',))]
    fn test_reveal_wrong_role() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, _, _, _, _) = setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.start_game(GAME_ID);
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player2);

        let mut players = ArrayTrait::new();
        players.append(player2);
        players.append(player3);
        players.append(player4);

        let mut commitments = ArrayTrait::new();
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player2, super::ROLE_MAFIA, 123));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player3, super::ROLE_VILLAGER, 456));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player4, super::ROLE_VILLAGER, 789));

        state.submit_role_commitments(GAME_ID, players, commitments, 1, 2);

        state.eliminate_player_by_mafia(GAME_ID, player2, 1, 123, 456);
        state.reveal_role(GAME_ID, player2, super::ROLE_VILLAGER, 123); // Should panic
    }

    // fn check_all_active_players_day_voted(self: @TContractState, game_id: felt252, day_id: u32)
    // -> bool;
    // fn check_all_players_mod_voted(self: @TContractState, game_id: felt252) -> bool;
    #[test]
    #[available_gas(2000000000)]
    fn test_check_all_active_players_day_voted() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, player5, player6, player7, player8) =
            setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.join_game(player5, GAME_ID, 'Eve', 131415, 131415);
        state.join_game(player6, GAME_ID, 'Frank', 161718, 161718);
        state.join_game(player7, GAME_ID, 'Grace', 192021, 192021);
        state.join_game(player8, GAME_ID, 'Hank', 222324, 222324);
        state.start_game(GAME_ID);
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player2);
        state.cast_moderator_vote(player5, GAME_ID, player1);
        state.cast_moderator_vote(player6, GAME_ID, player1);
        state.cast_moderator_vote(player7, GAME_ID, player1);
        state.cast_moderator_vote(player8, GAME_ID, player1);

        let mut players = ArrayTrait::new();
        players.append(player1);
        players.append(player3);
        players.append(player4);
        players.append(player5);
        players.append(player6);
        players.append(player7);
        players.append(player8);

        let mut commitments = ArrayTrait::new();
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player2, super::ROLE_MAFIA, 123));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player3, super::ROLE_MAFIA, 456));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player4, super::ROLE_VILLAGER, 789));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player5, super::ROLE_VILLAGER, 101112));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player6, super::ROLE_VILLAGER, 131415));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player7, super::ROLE_VILLAGER, 161718));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player8, super::ROLE_VILLAGER, 192021));

        state.submit_role_commitments(GAME_ID, players, commitments, 2, 5);

        let mafia1_commitment = state.get_mafia_commitment_hash(GAME_ID, player2, player8, 123);
        let mafia2_commitment = state.get_mafia_commitment_hash(GAME_ID, player3, player8, 456);

        state.eliminate_player_by_mafia(GAME_ID, player8, 2, mafia1_commitment, mafia2_commitment);
        state.reveal_role(GAME_ID, player8, super::ROLE_VILLAGER, 192021);

        state.vote(player2, GAME_ID, 0, player7);
        state.vote(player3, GAME_ID, 0, player4);
        state.vote(player4, GAME_ID, 0, player3);
        state.vote(player5, GAME_ID, 0, player3);
        state.vote(player6, GAME_ID, 0, player3);
        state.vote(player7, GAME_ID, 0, player3);

        state.reveal_role(GAME_ID, player3, super::ROLE_MAFIA, 456);

        assert(
            state.check_all_active_players_day_voted(GAME_ID, 0), 'All players should have voted',
        );
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.current_phase == super::PHASE_NIGHT, 'Should be in night phase');
        assert(game_state.current_day == 1, 'Should be day 1');
        assert(game_state.active_mafia_count == 1, 'Active mafia count should be 1');
        assert(game_state.active_villager_count == 4, 'Active villager should be 4');
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_vote() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, player5, player6, player7, player8) =
            setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.join_game(player5, GAME_ID, 'Eve', 131415, 131415);
        state.join_game(player6, GAME_ID, 'Frank', 161718, 161718);
        state.join_game(player7, GAME_ID, 'Grace', 192021, 192021);
        state.join_game(player8, GAME_ID, 'Hank', 222324, 222324);
        state.start_game(GAME_ID);
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player2);
        state.cast_moderator_vote(player5, GAME_ID, player2);
        state.cast_moderator_vote(player6, GAME_ID, player2);
        state.cast_moderator_vote(player7, GAME_ID, player2);
        state.cast_moderator_vote(player8, GAME_ID, player2);

        let mut players = ArrayTrait::new();
        players.append(player1);
        players.append(player3);
        players.append(player4);
        players.append(player5);
        players.append(player6);
        players.append(player7);
        players.append(player8);

        let mut commitments = ArrayTrait::new();
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player1, super::ROLE_MAFIA, 123));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player3, super::ROLE_MAFIA, 456));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player4, super::ROLE_VILLAGER, 789));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player5, super::ROLE_VILLAGER, 101112));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player6, super::ROLE_VILLAGER, 131415));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player7, super::ROLE_VILLAGER, 161718));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player8, super::ROLE_VILLAGER, 192021));

        state.submit_role_commitments(GAME_ID, players, commitments, 2, 5);

        let mafia1_commitment = state.get_mafia_commitment_hash(GAME_ID, player1, player8, 123);
        let mafia2_commitment = state.get_mafia_commitment_hash(GAME_ID, player3, player8, 456);

        state.eliminate_player_by_mafia(GAME_ID, player8, 2, mafia1_commitment, mafia2_commitment);
        state.reveal_role(GAME_ID, player8, super::ROLE_VILLAGER, 192021);

        // When
        state.vote(player1, GAME_ID, 0, player7);
        state.vote(player3, GAME_ID, 0, player4);
        state.vote(player4, GAME_ID, 0, player3);
        state.vote(player5, GAME_ID, 0, player3);
        state.vote(player6, GAME_ID, 0, player3);
        state.vote(player7, GAME_ID, 0, player3);

        state.reveal_role(GAME_ID, player3, super::ROLE_MAFIA, 456);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.current_phase == super::PHASE_NIGHT, 'Should be in night phase');
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_villager_win() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, player5, player6, player7, player8) =
            setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.join_game(player5, GAME_ID, 'Eve', 131415, 131415);
        state.join_game(player6, GAME_ID, 'Frank', 161718, 161718);
        state.join_game(player7, GAME_ID, 'Grace', 192021, 192021);
        state.join_game(player8, GAME_ID, 'Hank', 222324, 222324);
        state.start_game(GAME_ID);
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player1);
        state.cast_moderator_vote(player5, GAME_ID, player1);
        state.cast_moderator_vote(player6, GAME_ID, player2);
        state.cast_moderator_vote(player7, GAME_ID, player2);
        state.cast_moderator_vote(player8, GAME_ID, player2);

        let mut players = ArrayTrait::new();
        players.append(player2);
        players.append(player3);
        players.append(player4);
        players.append(player5);
        players.append(player6);
        players.append(player7);
        players.append(player8);

        let mut commitments = ArrayTrait::new();
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player2, super::ROLE_MAFIA, 123));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player3, super::ROLE_MAFIA, 456));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player4, super::ROLE_VILLAGER, 789));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player5, super::ROLE_VILLAGER, 101112));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player6, super::ROLE_VILLAGER, 131415));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player7, super::ROLE_VILLAGER, 161718));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player8, super::ROLE_VILLAGER, 192021));

        state.submit_role_commitments(GAME_ID, players, commitments, 2, 5);

        let mafia1_commitment = state.get_mafia_commitment_hash(GAME_ID, player2, player8, 123);
        let mafia2_commitment = state.get_mafia_commitment_hash(GAME_ID, player3, player8, 456);

        state.eliminate_player_by_mafia(GAME_ID, player8, 2, mafia1_commitment, mafia2_commitment);
        state.reveal_role(GAME_ID, player8, super::ROLE_VILLAGER, 192021);

        // When
        state.vote(player2, GAME_ID, 0, player7);
        state.vote(player3, GAME_ID, 0, player4);
        state.vote(player4, GAME_ID, 0, player3);
        state.vote(player5, GAME_ID, 0, player3);
        state.vote(player6, GAME_ID, 0, player3);
        state.vote(player7, GAME_ID, 0, player3);

        state.reveal_role(GAME_ID, player3, super::ROLE_MAFIA, 456);

        let mafia1_commitment = state.get_mafia_commitment_hash(GAME_ID, player2, player7, 123);
        let mafia2_commitment = state.get_mafia_commitment_hash(GAME_ID, player3, player7, 456);

        state.eliminate_player_by_mafia(GAME_ID, player7, 1, mafia1_commitment, mafia2_commitment);
        state.reveal_role(GAME_ID, player7, super::ROLE_VILLAGER, 161718);

        state.vote(player2, GAME_ID, 1, player4);
        state.vote(player4, GAME_ID, 1, player2);
        state.vote(player5, GAME_ID, 1, player2);
        state.vote(player6, GAME_ID, 1, player2);
        state.reveal_role(GAME_ID, player2, super::ROLE_MAFIA, 123);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.ended == true, 'Game should have ended');

        let winner = state.check_winner(GAME_ID);
        assert(winner == super::WINNER_VILLAGERS, 'Villagers should have won');
    }

    #[test]
    #[available_gas(2000000000)]
    fn test_mafia_win() {
        // Given
        let mut state = MafiaGame::contract_state_for_testing();
        let (player1, player2, player3, player4, player5, player6, player7, player8) =
            setup_players();

        // Setup game with 4 players
        state.create_game(GAME_ID);
        state.join_game(player1, GAME_ID, 'Alice', 123, 123);
        state.join_game(player2, GAME_ID, 'Bob', 456, 456);
        state.join_game(player3, GAME_ID, 'Charlie', 789, 789);
        state.join_game(player4, GAME_ID, 'Dave', 101112, 101112);
        state.join_game(player5, GAME_ID, 'Eve', 131415, 131415);
        state.join_game(player6, GAME_ID, 'Frank', 161718, 161718);
        state.join_game(player7, GAME_ID, 'Grace', 192021, 192021);
        state.join_game(player8, GAME_ID, 'Hank', 222324, 222324);
        state.start_game(GAME_ID);
        state.cast_moderator_vote(player1, GAME_ID, player1);
        state.cast_moderator_vote(player2, GAME_ID, player1);
        state.cast_moderator_vote(player3, GAME_ID, player1);
        state.cast_moderator_vote(player4, GAME_ID, player1);
        state.cast_moderator_vote(player5, GAME_ID, player1);
        state.cast_moderator_vote(player6, GAME_ID, player2);
        state.cast_moderator_vote(player7, GAME_ID, player2);
        state.cast_moderator_vote(player8, GAME_ID, player2);

        let mut players = ArrayTrait::new();
        players.append(player2);
        players.append(player3);
        players.append(player4);
        players.append(player5);
        players.append(player6);
        players.append(player7);
        players.append(player8);

        let mut commitments = ArrayTrait::new();
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player2, super::ROLE_MAFIA, 123));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player3, super::ROLE_MAFIA, 456));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player4, super::ROLE_VILLAGER, 789));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player5, super::ROLE_VILLAGER, 101112));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player6, super::ROLE_VILLAGER, 131415));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player7, super::ROLE_VILLAGER, 161718));
        commitments
            .append(state.get_role_commitment_hash(GAME_ID, player8, super::ROLE_VILLAGER, 192021));

        state.submit_role_commitments(GAME_ID, players, commitments, 2, 5);

        let mafia1_commitment = state.get_mafia_commitment_hash(GAME_ID, player2, player8, 123);
        let mafia2_commitment = state.get_mafia_commitment_hash(GAME_ID, player3, player8, 456);

        state.eliminate_player_by_mafia(GAME_ID, player8, 2, mafia1_commitment, mafia2_commitment);
        state.reveal_role(GAME_ID, player8, super::ROLE_VILLAGER, 192021);

        // When
        state.vote(player2, GAME_ID, 0, player7);
        state.vote(player3, GAME_ID, 0, player7);
        state.vote(player4, GAME_ID, 0, player7);
        state.vote(player5, GAME_ID, 0, player7);
        state.vote(player6, GAME_ID, 0, player3);
        state.vote(player7, GAME_ID, 0, player3);

        state.reveal_role(GAME_ID, player7, super::ROLE_VILLAGER, 161718);

        let mafia1_commitment = state.get_mafia_commitment_hash(GAME_ID, player2, player6, 123);
        let mafia2_commitment = state.get_mafia_commitment_hash(GAME_ID, player3, player6, 456);

        state.eliminate_player_by_mafia(GAME_ID, player6, 2, mafia1_commitment, mafia2_commitment);
        state.reveal_role(GAME_ID, player6, super::ROLE_VILLAGER, 131415);

        state.vote(player2, GAME_ID, 1, player4);
        state.vote(player3, GAME_ID, 1, player4);
        state.vote(player4, GAME_ID, 1, player5);
        state.vote(player5, GAME_ID, 1, player4);
        state.reveal_role(GAME_ID, player4, super::ROLE_VILLAGER, 789);

        // Then
        let game_state = state.get_game_state(GAME_ID);
        assert(game_state.ended == true, 'Game should have ended');

        let winner = state.check_winner(GAME_ID);
        assert(winner == super::WINNER_MAFIA, 'Mafia should have won');
    }
}
