// use core::starknet::ContractAddress;

// #[starknet::interface]
// trait IMafiaGame<TContractState> {
//     fn join_game(ref self: TContractState, game_id: felt252, public_identity_key: felt252);
//     fn start_game(ref self: TContractState, game_id: felt252);
//     fn vote_for_moderator(ref self: TContractState, game_id: felt252, candidate: ContractAddress);
//     fn finalize_moderator_selection(ref self: TContractState, game_id: felt252);
//     fn submit_role_commitments(
//         ref self: TContractState,
//         game_id: felt252,
//         players: Array<ContractAddress>,
//         commitments: Array<felt252>,
//     );
//     fn reveal_role(
//         ref self: TContractState,
//         game_id: felt252,
//         player: ContractAddress,
//         role: u8,
//         nonce: felt252
//     );
//     fn vote(
//         ref self: TContractState, game_id: felt252, day_id: u32, votee: ContractAddress
//     );
//     fn end_day(ref self: TContractState, game_id: felt252, day_id: u32);
//     fn get_phase(self: @TContractState, game_id: felt252) -> u8;
//     fn is_game_started(self: @TContractState, game_id: felt252) -> bool;
//     fn is_game_ended(self: @TContractState, game_id: felt252) -> bool;
//     fn get_current_day(self: @TContractState, game_id: felt252) -> u32;
// }

// #[starknet::contract]
// mod MafiaGame {
//     use super::IMafiaGame;
//     use core::starknet::{ContractAddress, get_caller_address, contract_address_const, get_block_timestamp};
//     use core::starknet::storage::{
//         StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
//         StorageMapWriteAccess, Map,
//     };
//     use core::array::ArrayTrait;
//     use core::box::BoxTrait;
//     use core::option::OptionTrait;
//     use core::hash::LegacyHash;
//     use core::pedersen::pedersen;

//     #[derive(Copy, Drop, Serde, starknet::Store)]
//     struct PlayerInfo {
//         address: ContractAddress,
//         public_identity_key: felt252,
//         has_voted_moderator: bool,
//     }

//     #[derive(Copy, Drop, Serde, starknet::Store)]
//     struct GameState {
//         started: bool,
//         ended: bool,
//         current_phase: u8,
//         player_count: u32,
//         current_day: u32,
//         moderator: ContractAddress,
//         is_moderator_chosen: bool,
//         mafia_count: u32,
//         villager_count: u32,
//     }

//     #[storage]
//     struct Storage {
//         // Game state management
//         games: Map<felt252, GameState>,
//         // Player management per game
//         game_players: Map<(felt252, ContractAddress), PlayerInfo>,
//         game_player_addresses: Map<(felt252, u32), ContractAddress>,
//         game_active_players: Map<(felt252, ContractAddress), bool>,
//         game_eliminated_players: Map<(felt252, ContractAddress), bool>,
//         // Moderator voting per game
//         game_moderator_votes: Map<(felt252, ContractAddress), ContractAddress>,
//         game_moderator_vote_counts: Map<(felt252, ContractAddress), u32>,
//         // Role management per game
//         game_role_commitments: Map<(felt252, ContractAddress), felt252>,
//         game_revealed_roles: Map<(felt252, ContractAddress), u8>,
//         // Voting system per game and day
//         game_day_votes: Map<(felt252, u32, ContractAddress), ContractAddress>,
//         game_day_vote_counts: Map<(felt252, u32, ContractAddress), u32>,
//     }

//     // ... [Previous events remain the same, just add game_id to their fields] ...

//     #[constructor]
//     fn constructor(ref self: ContractState) {
//         // No need for initialization as we'll create game states dynamically
//     }

//     #[abi(embed_v0)]
//     impl MafiaGameImpl of super::IMafiaGame<ContractState> {
//         fn join_game(ref self: ContractState, game_id: felt252, public_identity_key: felt252) {
//             let mut game_state = self._get_or_create_game(game_id);
//             assert(!game_state.started, 'Game already started');
            
//             let caller = get_caller_address();
//             let existing_player = self.game_players.read((game_id, caller));
//             assert(existing_player.address == contract_address_const::<0>(), 'Already joined');

//             let player_info = PlayerInfo {
//                 address: caller,
//                 public_identity_key: public_identity_key,
//                 has_voted_moderator: false,
//             };

//             self.game_players.write((game_id, caller), player_info);
//             self.game_active_players.write((game_id, caller), true);
//             self.game_player_addresses.write((game_id, game_state.player_count), caller);
            
//             game_state.player_count += 1;
//             self.games.write(game_id, game_state);

//             self.emit(PlayerRegistered { 
//                 game_id,
//                 player: caller,
//                 public_identity_key,
//             });
//         }

//         fn start_game(ref self: ContractState, game_id: felt252) {
//             let mut game_state = self._get_game(game_id);
//             assert(!game_state.started, 'Game already started');
//             assert(game_state.player_count >= 4, 'Not enough players');

//             game_state.started = true;
//             game_state.current_phase = 1; // MODERATOR_VOTE phase
//             game_state.current_day = 0;
//             self.games.write(game_id, game_state);

//             self.emit(GameStarted {
//                 game_id,
//                 timestamp: get_block_timestamp(),
//                 player_count: game_state.player_count,
//             });
//             self.emit(PhaseChanged { game_id, new_phase: 1 });
//         }

//         // ... [Other implementation functions follow the same pattern] ...

//         fn vote(
//             ref self: ContractState,
//             game_id: felt252,
//             day_id: u32,
//             votee: ContractAddress
//         ) {
//             let game_state = self._get_game(game_id);
//             assert(game_state.started, 'Game not started');
//             assert(game_state.current_phase == 5, 'Not voting phase');
//             assert(game_state.current_day == day_id, 'Invalid day');

//             let caller = get_caller_address();
//             assert(self.game_active_players.read((game_id, caller)), 'Not active player');
//             assert(self.game_active_players.read((game_id, votee)), 'Invalid vote target');

//             // Update previous vote if exists
//             let previous_vote = self.game_day_votes.read((game_id, day_id, caller));
//             if previous_vote != contract_address_const::<0>() {
//                 let current_count = self.game_day_vote_counts.read((game_id, day_id, previous_vote));
//                 self.game_day_vote_counts.write((game_id, day_id, previous_vote), current_count - 1);
//             }

//             // Record new vote
//             self.game_day_votes.write((game_id, day_id, caller), votee);
//             let current_count = self.game_day_vote_counts.read((game_id, day_id, votee));
//             self.game_day_vote_counts.write((game_id, day_id, votee), current_count + 1);
//         }

//         fn get_phase(self: @ContractState, game_id: felt252) -> u8 {
//             self._get_game(game_id).current_phase
//         }

//         fn is_game_started(self: @ContractState, game_id: felt252) -> bool {
//             self._get_game(game_id).started
//         }

//         fn is_game_ended(self: @ContractState, game_id: felt252) -> bool {
//             self._get_game(game_id).ended
//         }

//         fn get_current_day(self: @ContractState, game_id: felt252) -> u32 {
//             self._get_game(game_id).current_day
//         }
//     }

//     #[generate_trait]
//     impl InternalFunctions of InternalFunctionsTrait {
//         fn _get_or_create_game(ref self: ContractState, game_id: felt252) -> GameState {
//             let game_state = self.games.read(game_id);
//             if game_state.started == false && game_state.ended == false {
//                 return GameState {
//                     started: false,
//                     ended: false,
//                     current_phase: 0,
//                     player_count: 0,
//                     current_day: 0,
//                     moderator: contract_address_const::<0>(),
//                     is_moderator_chosen: false,
//                     mafia_count: 0,
//                     villager_count: 0,
//                 };
//             }
//             game_state
//         }

//         fn _get_game(self: @ContractState, game_id: felt252) -> GameState {
//             let game_state = self.games.read(game_id);
//             assert(game_state.player_count > 0, 'Game does not exist');
//             game_state
//         }

//         // ... [Other internal functions follow the same pattern] ...
//     }
// }