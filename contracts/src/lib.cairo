use core::starknet::ContractAddress;

#[derive(Copy, Drop, Serde, starknet::Store)]
struct PlayerInfo {
    name: felt252,
    address: ContractAddress,
    public_identity_key: felt252,
    has_voted_moderator: bool,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
struct GameState {
    started: bool,
    ended: bool,
    current_phase: u8,
    player_count: u32,
    current_day: u32,
    moderator: ContractAddress,
    is_moderator_chosen: bool,
    mafia_count: u32,
    villager_count: u32,
}

const GAME_SETUP: u8 = 0;
const MODERATOR_VOTE: u8 = 1;
const ROLE_ASSIGNMENT: u8 = 2;
const NIGHT: u8 = 3;
const DAY: u8 = 4;
const VOTING: u8 = 5;

#[starknet::interface]
trait IMafiaGame<TContractState> {
    fn join_game(
        ref self: TContractState,
        player: ContractAddress,
        game_id: felt252,
        name: felt252,
        public_identity_key: felt252,
    );
    fn start_game(ref self: TContractState, game_id: felt252);
    fn vote_for_moderator(
        ref self: TContractState,
        player: ContractAddress,
        game_id: felt252,
        candidate: ContractAddress,
    );
    fn finalize_moderator_selection(ref self: TContractState, game_id: felt252);
    // fn submit_role_commitments(
    //     ref self: TContractState,
    //     game_id: felt252,
    //     players: Array<ContractAddress>,
    //     commitments: Array<felt252>,
    // );
    // fn reveal_role(
    //     ref self: TContractState,
    //     game_id: felt252,
    //     player: ContractAddress,
    //     role: u8,
    //     nonce: felt252
    // );
    // fn vote(
    //     ref self: TContractState, game_id: felt252, day_id: u32, votee: ContractAddress
    // );
    // fn end_day(ref self: TContractState, game_id: felt252, day_id: u32);
    fn get_game_state(self: @TContractState, game_id: felt252) -> GameState;    
    fn get_moderator(self: @TContractState, game_id: felt252) -> ContractAddress;
    fn get_players(self: @TContractState, game_id: felt252) -> Array<ContractAddress>;
    fn get_player_info(
        self: @TContractState, game_id: felt252, player: ContractAddress,
    ) -> PlayerInfo;
    fn get_phase(self: @TContractState, game_id: felt252) -> u8;
    fn is_game_started(self: @TContractState, game_id: felt252) -> bool;
    fn is_game_ended(self: @TContractState, game_id: felt252) -> bool;
    fn get_current_day(self: @TContractState, game_id: felt252) -> u32;
    fn does_game_exist(self: @TContractState, game_id: felt252) -> bool;
}

#[starknet::contract]
mod MafiaGame {
    use super::IMafiaGame;
    use core::starknet::{
        ContractAddress, contract_address_const, get_block_timestamp,
    };
    use core::starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess, Map,
    };
    use core::array::ArrayTrait;
    use core::box::BoxTrait;
    use core::option::OptionTrait;
    use core::hash::LegacyHash;
    use core::pedersen::pedersen;


    #[storage]
    struct Storage {
        // Game state management
        games: Map<felt252, super::GameState>,
        // Player management per game
        game_players: Map<(felt252, ContractAddress), super::PlayerInfo>,
        game_player_addresses: Map<(felt252, u32), ContractAddress>,
        game_active_players: Map<(felt252, ContractAddress), bool>,
        game_eliminated_players: Map<(felt252, ContractAddress), bool>,
        // Moderator voting per game
        game_moderator_votes: Map<(felt252, ContractAddress), ContractAddress>,
        game_moderator_vote_counts: Map<(felt252, ContractAddress), u32>,
        // Role management per game
        game_role_commitments: Map<(felt252, ContractAddress), felt252>,
        game_revealed_roles: Map<(felt252, ContractAddress), u8>,
        // Voting system per game and day
        game_day_votes: Map<(felt252, u32, ContractAddress), ContractAddress>,
        game_day_vote_counts: Map<(felt252, u32, ContractAddress), u32>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GameStarted: GameStarted,
        PlayerRegistered: PlayerRegistered,
        ModeratorVoteCast: ModeratorVoteCast,
        ModeratorChosen: ModeratorChosen,
        RoleCommitmentSubmitted: RoleCommitmentSubmitted,
        RoleRevealed: RoleRevealed,
        PlayerEliminated: PlayerEliminated,
        PhaseChanged: PhaseChanged,
        GameEnded: GameEnded,
    }

    #[derive(Drop, starknet::Event)]
    struct GameStarted {
        game_id: felt252,
        timestamp: u64,
        player_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct PlayerRegistered {
        game_id: felt252,
        player: ContractAddress,
        // name: felt252,
        public_identity_key: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ModeratorVoteCast {
        game_id: felt252,
        voter: ContractAddress,
        candidate: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct ModeratorChosen {
        game_id: felt252,
        moderator: ContractAddress,
        // name: felt252,
        vote_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct RoleCommitmentSubmitted {
        game_id: felt252,
        player: ContractAddress,
        commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct RoleRevealed {
        game_id: felt252,
        player: ContractAddress,
        role: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct PlayerEliminated {
        game_id: felt252,
        player: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PhaseChanged {
        game_id: felt252,
        new_phase: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct GameEnded {
        game_id: felt252,
        winner: u8 // 0: Villagers, 1: Mafia
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MafiaGameImpl of super::IMafiaGame<ContractState> {
        fn join_game(
            ref self: ContractState,
            player: ContractAddress,
            game_id: felt252,
            name: felt252,
            public_identity_key: felt252,
        ) {
            let mut game_state = self._get_or_create_game(game_id);
            assert(!game_state.started, 'Game already started');

            let caller = player.clone();
            let existing_player = self.game_players.read((game_id, caller));
            assert(existing_player.address == contract_address_const::<0>(), 'Already joined');

            let player_info = super::PlayerInfo {
                name,
                address: caller,
                public_identity_key: public_identity_key,
                has_voted_moderator: false,
            };

            self.game_players.write((game_id, caller), player_info);
            self.game_active_players.write((game_id, caller), true);
            self.game_player_addresses.write((game_id, game_state.player_count), caller);

            game_state.player_count += 1;
            self.games.write(game_id, game_state);

            self.emit(PlayerRegistered { game_id, player: caller, public_identity_key });
        }

        fn start_game(ref self: ContractState, game_id: felt252) {
            let mut game_state = self._get_game(game_id);
            assert(!game_state.started, 'Game already started');
            assert(game_state.player_count >= 4, 'Not enough players');

            game_state.started = true;
            game_state.current_phase = super::MODERATOR_VOTE; // MODERATOR_VOTE phase
            game_state.current_day = 0;
            self.games.write(game_id, game_state);

            self
                .emit(
                    GameStarted {
                        game_id,
                        timestamp: get_block_timestamp(),
                        player_count: game_state.player_count,
                    },
                );
            self.emit(PhaseChanged { game_id, new_phase: super::MODERATOR_VOTE });
        }

        fn get_phase(self: @ContractState, game_id: felt252) -> u8 {
            self._get_game(game_id).current_phase
        }

        fn is_game_started(self: @ContractState, game_id: felt252) -> bool {
            self._get_game(game_id).started
        }

        fn is_game_ended(self: @ContractState, game_id: felt252) -> bool {
            self._get_game(game_id).ended
        }

        fn get_current_day(self: @ContractState, game_id: felt252) -> u32 {
            self._get_game(game_id).current_day
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

        fn does_game_exist(self: @ContractState, game_id: felt252) -> bool {
            let game_state = self.games.read(game_id);
            game_state.player_count > 0
        }
        fn vote_for_moderator(
            ref self: ContractState,
            player: ContractAddress,
            game_id: felt252,
            candidate: ContractAddress,
        ) {
            let caller = player.clone();
            let game_state = self._get_game(game_id);
            assert(game_state.started, 'Game not started');
            assert(game_state.current_phase == super::MODERATOR_VOTE, 'Not moderator voting phase');

            let voter = self.game_players.read((game_id, caller));
            assert(voter.address != contract_address_const::<0>(), 'Invalid player');
            assert(!voter.has_voted_moderator, 'Already voted');

            // voter.has_voted_moderatortrue;

            let candidate_player = self.game_players.read((game_id, candidate));
            assert(candidate_player.address != contract_address_const::<0>(), 'Invalid candidate');

            self
                .game_players
                .write(
                    (game_id, caller),
                    super::PlayerInfo {
                        name: voter.name,
                        address: voter.address,
                        public_identity_key: voter.public_identity_key,
                        has_voted_moderator: true,
                    },
                );
            self.game_moderator_votes.write((game_id, caller), candidate);
            self
                .game_moderator_vote_counts
                .write(
                    (game_id, candidate),
                    self.game_moderator_vote_counts.read((game_id, candidate)) + 1,
                );

            self.emit(ModeratorVoteCast { game_id, voter: caller, candidate });
        }

        fn finalize_moderator_selection(ref self: ContractState, game_id: felt252) {
            let mut game_state = self._get_game(game_id);
            assert(game_state.started, 'Game not started');
            assert(game_state.current_phase == super::MODERATOR_VOTE, 'Not moderator voting phase');
            assert(!game_state.is_moderator_chosen, 'Moderator already chosen');
            let chosen_moderator = self._get_winning_moderator(game_id);

            game_state.moderator = chosen_moderator;
            game_state.is_moderator_chosen = true;
            game_state.current_phase = super::ROLE_ASSIGNMENT; // Move to ROLE_ASSIGNMENT phase
            self.games.write(game_id, game_state);

            self
                .emit(
                    ModeratorChosen {
                        game_id,
                        moderator: chosen_moderator,
                        vote_count: self
                            .game_moderator_vote_counts
                            .read((game_id, chosen_moderator)),
                    },
                );
            self.emit(PhaseChanged { game_id, new_phase: super::ROLE_ASSIGNMENT });
        }

        fn get_moderator(self: @ContractState, game_id: felt252) -> ContractAddress {
            assert(self.does_game_exist(game_id), 'Game does not exist');
            assert(self.is_game_started(game_id), 'Game not started');
            assert(self.get_phase(game_id) >= super::ROLE_ASSIGNMENT, 'Incorrect phase');
            self._get_game(game_id).moderator
        }

        fn get_game_state(self: @ContractState, game_id: felt252) -> super::GameState {
            self._get_game(game_id)
        }
        // fn submit_role_commitments(
    //     ref self: ContractState, players: Array<ContractAddress>, commitments:
    //     Array<felt252>,
    // ) {
    //     let caller = get_caller_address();
    //     assert(caller == self.moderator.read(), 'Not moderator');
    //     assert(self.current_phase.read() == 2, 'Not role assignment phase');

        //     let mut i: u32 = 0;
    //     let players_len = players.len();
    //     assert(players_len == commitments.len(), 'Array length mismatch');

        //     loop {
    //         if i >= players_len {
    //             break;
    //         }

        //         let player = *players.at(i);
    //         let commitment = *commitments.at(i);

        //         let player_info = self.players.read(player);
    //         assert(player_info.address != contract_address_const::<0>(), 'Invalid player');

        //         self.role_commitments.write(player, commitment);
    //         self.emit(RoleCommitmentSubmitted { player, commitment });

        //         i += 1;
    //     };

        //     self.current_phase.write(3); // Move to NIGHT phase
    //     self.emit(PhaseChanged { new_phase: 3 });
    // }

        // fn reveal_role(ref self: ContractState, player: ContractAddress, role: u8, nonce:
    // felt252) {
    //     let caller = get_caller_address();
    //     assert(caller == self.moderator.read(), 'Not moderator');
    //     assert(self.game_started.read(), 'Game not started');

        //     // Verify commitment
    //     let commitment = self.role_commitments.read(player);
    //     let calculated_commitment = pedersen(pedersen(player.into(), role.into()), nonce);
    //     assert(commitment == calculated_commitment, 'Invalid commitment');

        //     // Check valid role
    //     assert(role == 0 || role == 1, 'Invalid role');

        //     self.revealed_roles.write(player, role);
    //     if role == 1 { // Mafia
    //         self.mafia_count.write(self.mafia_count.read() + 1);
    //     } else { // Villager
    //         self.villager_count.write(self.villager_count.read() + 1);
    //     }

        //     self.emit(RoleRevealed { player, role });
    // }

        // fn vote(ref self: ContractState, votee: ContractAddress) {
    //     let caller = get_caller_address();
    //     assert(self.game_started.read(), 'Game not started');
    //     assert(self.current_phase.read() == 5, 'Not voting phase');
    //     assert(self.active_players.read(caller), 'Not active player');
    //     assert(self.active_players.read(votee), 'Invalid vote target');

        //     // Update previous vote if exists
    //     let previous_vote = self.current_votes.read(caller);
    //     if previous_vote != contract_address_const::<0>() {
    //         self.vote_count.write(previous_vote, self.vote_count.read(previous_vote) - 1);
    //     }

        //     // Record new vote
    //     self.current_votes.write(caller, votee);
    //     self.vote_count.write(votee, self.vote_count.read(votee) + 1);
    // }

        // fn end_day(ref self: ContractState) {
    //     assert(self.game_started.read(), 'Game not started');
    //     assert(self.current_phase.read() == 5, 'Not voting phase');

        //     // Process votes and eliminate player
    //     let eliminated = self._get_most_voted_player();
    //     self.active_players.write(eliminated, false);
    //     self.eliminated_players.write(eliminated, true);

        //     // Update role counts
    //     let eliminated_role = self.revealed_roles.read(eliminated);
    //     if eliminated_role == 1 { // Mafia
    //         self.mafia_count.write(self.mafia_count.read() - 1);
    //     } else {
    //         self.villager_count.write(self.villager_count.read() - 1);
    //     }

        //     self.emit(PlayerEliminated { player: eliminated });

        //     // Check win conditions
    //     if self._check_win_condition() {
    //         self.game_ended.write(true);
    //         self.emit(GameEnded { winner: if self.mafia_count.read() == 0 {
    //             0
    //         } else {
    //             1
    //         } });
    //     } else {
    //         self.current_phase.write(3); // Back to NIGHT phase
    //         self.emit(PhaseChanged { new_phase: 3 });
    //     }

        //     // Reset votes
    //     self._reset_votes();
    // }

        // View functions
    // fn get_player_info(self: @ContractState, player: ContractAddress) -> PlayerInfo {
    //     self.players.read(player)
    // }

        // fn get_phase(self: @ContractState) -> u8 {
    //     self.current_phase.read()
    // }

        // fn is_game_started(self: @ContractState) -> bool {
    //     self.game_started.read()
    // }

        // fn is_game_ended(self: @ContractState) -> bool {
    //     self.game_ended.read()
    // }
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

        // fn _assign_roles(ref self: ContractState) {
        //     // Simplified role assignment - in practice, use randomness from VRF
        //     let total_players = self.player_count.read();
        //     let mafia_count = total_players / 4; // 25% are mafia

        //     // Implementation needed: Assign roles to players
        //     self.mafia_count.write(mafia_count);
        //     self.villager_count.write(total_players - mafia_count);
        // }

        // fn _process_votes(ref self: ContractState) -> ContractAddress {
        //     // Implementation needed: Count votes and return player with most votes
        //     // For now, returns a placeholder
        //     get_caller_address()
        // }

        // fn _check_win_condition(ref self: ContractState) -> bool {
        //     let mafia_count = self.mafia_count.read();
        //     let villager_count = self.villager_count.read();

        //     mafia_count == 0 || mafia_count >= villager_count
        // }

        fn _get_or_create_game(ref self: ContractState, game_id: felt252) -> super::GameState {
            let game_state = self.games.read(game_id);
            if game_state.started == false && game_state.ended == false {
                return super::GameState {
                    started: false,
                    ended: false,
                    current_phase: 0,
                    player_count: 0,
                    current_day: 0,
                    moderator: contract_address_const::<0>(),
                    is_moderator_chosen: false,
                    mafia_count: 0,
                    villager_count: 0,
                };
            }
            game_state
        }

        fn _get_game(self: @ContractState, game_id: felt252) -> super::GameState {
            let game_state = self.games.read(game_id);
            assert(game_state.player_count > 0, 'Game does not exist');
            game_state
        }
    }
}
