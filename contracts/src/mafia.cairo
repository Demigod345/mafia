// #[starknet::interface]
// trait IMafiaGame<TContractState> {
//     fn join_game(ref self: TContractState, public_identity_key: felt252);
//     fn start_game(ref self: TContractState);
//     fn vote_for_moderator(ref self: TContractState, candidate: ContractAddress);
//     fn finalize_moderator_selection(ref self: TContractState);
//     fn submit_role_commitments(
//         ref self: TContractState,
//         players: Array<ContractAddress>,
//         commitments: Array<felt252>
//     );
//     fn reveal_role(
//         ref self: TContractState,
//         player: ContractAddress,
//         role: u8,
//         nonce: felt252
//     );
//     fn vote(ref self: TContractState, votee: ContractAddress);
//     fn end_day(ref self: TContractState);
//     fn get_player_info(self: @TContractState, player: ContractAddress) -> PlayerInfo;
//     fn get_phase(self: @TContractState) -> u8;
//     fn is_game_started(self: @TContractState) -> bool;
//     fn is_game_ended(self: @TContractState) -> bool;
// }

// #[starknet::contract]
// mod MafiaGame {
//     use super::IMafiaGame;
//     use starknet::{ContractAddress, get_caller_address, contract_address_const, get_block_timestamp};
//     use array::ArrayTrait;
//     use box::BoxTrait;
//     use option::OptionTrait;
//     use hash::LegacyHash;
//     use core::pedersen::pedersen;

//     #[derive(Copy, Drop, Serde, starknet::Store)]
//     struct PlayerInfo {
//         address: ContractAddress,
//         public_identity_key: felt252,
//         has_voted_moderator: bool,
//     }

//     #[storage]
//     struct Storage {
//         // Game state
//         game_started: bool,
//         game_ended: bool,
//         current_phase: u8, // 0: JOIN, 1: MODERATOR_VOTE, 2: ROLE_ASSIGNMENT, 3: NIGHT, 4: DAY, 5: VOTE
        
//         // Player management
//         players: LegacyMap<ContractAddress, PlayerInfo>,
//         player_count: u32,
//         player_addresses: LegacyMap<u32, ContractAddress>, // Index to address mapping
//         active_players: LegacyMap<ContractAddress, bool>,
//         eliminated_players: LegacyMap<ContractAddress, bool>,
        
//         // Moderator management
//         moderator: ContractAddress,
//         moderator_votes: LegacyMap<ContractAddress, ContractAddress>,
//         moderator_vote_counts: LegacyMap<ContractAddress, u32>,
//         is_moderator_chosen: bool,
        
//         // Role management and commitments
//         role_commitments: LegacyMap<ContractAddress, felt252>,
//         revealed_roles: LegacyMap<ContractAddress, u8>,
//         mafia_count: u32,
//         villager_count: u32,
        
//         // Voting system
//         current_votes: LegacyMap<ContractAddress, ContractAddress>,
//         vote_count: LegacyMap<ContractAddress, u32>,
//     }

//     #[event]
//     #[derive(Drop, starknet::Event)]
//     enum Event {
//         GameStarted: GameStarted,
//         PlayerRegistered: PlayerRegistered,
//         ModeratorVoteCast: ModeratorVoteCast,
//         ModeratorChosen: ModeratorChosen,
//         RoleCommitmentSubmitted: RoleCommitmentSubmitted,
//         RoleRevealed: RoleRevealed,
//         PlayerEliminated: PlayerEliminated,
//         PhaseChanged: PhaseChanged,
//         GameEnded: GameEnded,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct GameStarted {
//         timestamp: u64,
//         player_count: u32,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct PlayerRegistered {
//         player: ContractAddress,
//         public_identity_key: felt252,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct ModeratorVoteCast {
//         voter: ContractAddress,
//         candidate: ContractAddress,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct ModeratorChosen {
//         moderator: ContractAddress,
//         vote_count: u32,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct RoleCommitmentSubmitted {
//         player: ContractAddress,
//         commitment: felt252,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct RoleRevealed {
//         player: ContractAddress,
//         role: u8,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct PlayerEliminated {
//         player: ContractAddress,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct PhaseChanged {
//         new_phase: u8,
//     }

//     #[derive(Drop, starknet::Event)]
//     struct GameEnded {
//         winner: u8, // 0: Villagers, 1: Mafia
//     }

//     #[constructor]
//     fn constructor(ref self: ContractState) {
//         self.game_started.write(false);
//         self.game_ended.write(false);
//         self.current_phase.write(0);
//         self.player_count.write(0);
//         self.is_moderator_chosen.write(false);
//         self.moderator.write(contract_address_const::<0>());
//         self.mafia_count.write(0);
//         self.villager_count.write(0);
//     }

//     #[external(v0)]
//     impl MafiaGameImpl of super::IMafiaGame<ContractState> {
//         fn join_game(
//             ref self: ContractState, 
//             public_identity_key: felt252
//         ) {
//             assert(!self.game_started.read(), 'Game already started');
//             let caller = get_caller_address();
            
//             // Check if player hasn't already joined
//             let existing_player = self.players.read(caller);
//             assert(existing_player.address == contract_address_const::<0>(), 'Already joined');
            
//             let player_info = PlayerInfo {
//                 address: caller,
//                 public_identity_key: public_identity_key,
//                 has_voted_moderator: false,
//             };
            
//             let current_count = self.player_count.read();
//             self.players.write(caller, player_info);
//             self.active_players.write(caller, true);
//             self.player_addresses.write(current_count, caller);
//             self.player_count.write(current_count + 1);
            
//             self.emit(PlayerRegistered { 
//                 player: caller, 
//                 public_identity_key: public_identity_key 
//             });
//         }

//         fn start_game(ref self: ContractState) {
//             assert(!self.game_started.read(), 'Game already started');
//             assert(self.player_count.read() >= 4, 'Not enough players');
            
//             self.game_started.write(true);
//             self.current_phase.write(1); // MODERATOR_VOTE phase
            
//             self.emit(GameStarted { 
//                 timestamp: get_block_timestamp(),
//                 player_count: self.player_count.read() 
//             });
//             self.emit(PhaseChanged { new_phase: 1 });
//         }

//         fn vote_for_moderator(ref self: ContractState, candidate: ContractAddress) {
//             let caller = get_caller_address();
//             assert(self.game_started.read(), 'Game not started');
//             assert(self.current_phase.read() == 1, 'Not moderator voting phase');
            
//             let mut player_info = self.players.read(caller);
//             assert(!player_info.has_voted_moderator, 'Already voted for moderator');
            
//             let candidate_info = self.players.read(candidate);
//             assert(candidate_info.address != contract_address_const::<0>(), 'Invalid candidate');
            
//             // Record vote
//             self.moderator_votes.write(caller, candidate);
//             self.moderator_vote_counts.write(
//                 candidate,
//                 self.moderator_vote_counts.read(candidate) + 1
//             );
            
//             // Mark player as voted
//             player_info.has_voted_moderator = true;
//             self.players.write(caller, player_info);
            
//             self.emit(ModeratorVoteCast { voter: caller, candidate });
//         }

//         fn finalize_moderator_selection(ref self: ContractState) {
//             assert(self.game_started.read(), 'Game not started');
//             assert(self.current_phase.read() == 1, 'Not moderator voting phase');
//             assert(!self.is_moderator_chosen.read(), 'Moderator already chosen');
            
//             let chosen_moderator = self._get_winning_moderator();
//             self.moderator.write(chosen_moderator);
//             self.is_moderator_chosen.write(true);
//             self.current_phase.write(2); // Move to ROLE_ASSIGNMENT phase
            
//             self.emit(ModeratorChosen { 
//                 moderator: chosen_moderator,
//                 vote_count: self.moderator_vote_counts.read(chosen_moderator)
//             });
//             self.emit(PhaseChanged { new_phase: 2 });
//         }

//         fn submit_role_commitments(
//             ref self: ContractState,
//             players: Array<ContractAddress>,
//             commitments: Array<felt252>
//         ) {
//             let caller = get_caller_address();
//             assert(caller == self.moderator.read(), 'Not moderator');
//             assert(self.current_phase.read() == 2, 'Not role assignment phase');
            
//             let mut i: u32 = 0;
//             let players_len = players.len();
//             assert(players_len == commitments.len(), 'Array length mismatch');
            
//             loop {
//                 if i >= players_len {
//                     break;
//                 }
                
//                 let player = *players.at(i);
//                 let commitment = *commitments.at(i);
                
//                 let player_info = self.players.read(player);
//                 assert(player_info.address != contract_address_const::<0>(), 'Invalid player');
                
//                 self.role_commitments.write(player, commitment);
//                 self.emit(RoleCommitmentSubmitted { player, commitment });
                
//                 i += 1;
//             };
            
//             self.current_phase.write(3); // Move to NIGHT phase
//             self.emit(PhaseChanged { new_phase: 3 });
//         }

//         fn reveal_role(
//             ref self: ContractState,
//             player: ContractAddress,
//             role: u8,
//             nonce: felt252
//         ) {
//             let caller = get_caller_address();
//             assert(caller == self.moderator.read(), 'Not moderator');
//             assert(self.game_started.read(), 'Game not started');
            
//             // Verify commitment
//             let commitment = self.role_commitments.read(player);
//             let calculated_commitment = pedersen(
//                 pedersen(player.into(), role.into()),
//                 nonce
//             );
//             assert(commitment == calculated_commitment, 'Invalid commitment');
            
//             // Check valid role
//             assert(role == 0 || role == 1, 'Invalid role');
            
//             self.revealed_roles.write(player, role);
//             if role == 1 { // Mafia
//                 self.mafia_count.write(self.mafia_count.read() + 1);
//             } else { // Villager
//                 self.villager_count.write(self.villager_count.read() + 1);
//             }
            
//             self.emit(RoleRevealed { player, role });
//         }

//         fn vote(ref self: ContractState, votee: ContractAddress) {
//             let caller = get_caller_address();
//             assert(self.game_started.read(), 'Game not started');
//             assert(self.current_phase.read() == 5, 'Not voting phase');
//             assert(self.active_players.read(caller), 'Not active player');
//             assert(self.active_players.read(votee), 'Invalid vote target');
            
//             // Update previous vote if exists
//             let previous_vote = self.current_votes.read(caller);
//             if previous_vote != contract_address_const::<0>() {
//                 self.vote_count.write(
//                     previous_vote,
//                     self.vote_count.read(previous_vote) - 1
//                 );
//             }
            
//             // Record new vote
//             self.current_votes.write(caller, votee);
//             self.vote_count.write(votee, self.vote_count.read(votee) + 1);
//         }

//         fn end_day(ref self: ContractState) {
//             assert(self.game_started.read(), 'Game not started');
//             assert(self.current_phase.read() == 5, 'Not voting phase');
            
//             // Process votes and eliminate player
//             let eliminated = self._get_most_voted_player();
//             self.active_players.write(eliminated, false);
//             self.eliminated_players.write(eliminated, true);
            
//             // Update role counts
//             let eliminated_role = self.revealed_roles.read(eliminated);
//             if eliminated_role == 1 { // Mafia
//                 self.mafia_count.write(self.mafia_count.read() - 1);
//             } else {
//                 self.villager_count.write(self.villager_count.read() - 1);
//             }
            
//             self.emit(PlayerEliminated { player: eliminated });
            
//             // Check win conditions
//             if self._check_win_condition() {
//                 self.game_ended.write(true);
//                 self.emit(GameEnded { 
//                     winner: if self.mafia_count.read() == 0 { 0 } else { 1 }
//                 });
//             } else {
//                 self.current_phase.write(3); // Back to NIGHT phase
//                 self.emit(PhaseChanged { new_phase: 3 });
//             }
            
//             // Reset votes
//             self._reset_votes();
//         }

//         // View functions
//         fn get_player_info(self: @ContractState, player: ContractAddress) -> PlayerInfo {
//             self.players.read(player)
//         }

//         fn get_phase(self: @ContractState) -> u8 {
//             self.current_phase.read()
//         }

//         fn is_game_started(self: @ContractState) -> bool {
//             self.game_started.read()
//         }

//         fn is_game_ended(self: @ContractState) -> bool {
//             self.game_ended.read()
//         }
//     }

//     #[generate_trait]
//     impl InternalFunctions of InternalFunctionsTrait {
//     }
// }