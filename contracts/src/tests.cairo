// use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};

// use testing_smart_contracts_writing_tests::{
//     ISimpleContractDispatcher, ISimpleContractDispatcherTrait
// };

// // use starknet::ContractAddress;
// // use starknet::testing;
// // use core::traits::Into;
// // use core::array::ArrayTrait;
// // use core::result::ResultTrait;
// // use starknet::syscalls::deploy_syscall;
// // use core::option::OptionTrait;
// // use starknet::{
// //     contract_address_const, get_caller_address, get_contract_address, ClassHash
// // };
// // // Add these new imports
// // use starknet::class_hash::Felt252TryIntoClassHash;
// // use starknet::testing::{set_caller_address, set_contract_address, declare};
// // use core::traits::TryInto;


// // Import contract interface
// use super::IMafiaGame;
// use super::IMafiaGameDispatcher;
// use super::IMafiaGameDispatcherTrait;
// use super::PlayerInfo;

// #[test]
// fn test_game_creation() {
//     // Deploy contract
//     let contract = deploy_contract();
    
//     // Test initial game state
//     let game_id = 1;
//     let phase = contract.get_phase(game_id);
//     assert(phase == 0, 'Wrong initial phase');
    
//     let is_started = contract.is_game_started(game_id);
//     assert(!is_started, 'Game shouldn\'t be started');
    
//     let is_ended = contract.is_game_ended(game_id);
//     assert(!is_ended, 'Game shouldn\'t be ended');
    
//     let current_day = contract.get_current_day(game_id);
//     assert(current_day == 0, 'Wrong initial day');
    
//     let players = contract.get_players(game_id);
//     assert(players.len() == 0, 'Should have no players');
// }

// #[test]
// fn test_join_game() {
//     // Deploy contract
//     let contract = deploy_contract();
    
//     let game_id = 1;
//     let player1_address = contract_address_const::<1>();
//     let player2_address = contract_address_const::<2>();
    
//     // Test joining game
//     testing::set_caller_address(player1_address);
//     contract.join_game(game_id, 123);
    
//     testing::set_caller_address(player2_address);
//     contract.join_game(game_id, 456);
    
//     // Verify players
//     let players = contract.get_players(game_id);
//     assert(players.len() == 2, 'Wrong player count');
//     assert(*players.at(0) == player1_address, 'Wrong first player');
//     assert(*players.at(1) == player2_address, 'Wrong second player');
    
//     // Verify player info
//     let player1_info = contract.get_player_info(game_id, player1_address);
//     assert(player1_info.public_identity_key == 123, 'Wrong player1 key');
//     assert(!player1_info.has_voted_moderator, 'Should not have voted');
    
//     let player2_info = contract.get_player_info(game_id, player2_address);
//     assert(player2_info.public_identity_key == 456, 'Wrong player2 key');
//     assert(!player2_info.has_voted_moderator, 'Should not have voted');
// }

// #[test]
// #[should_panic(expected: ('Already joined',))]
// fn test_join_game_twice() {
//     let contract = deploy_contract();
//     let game_id = 1;
//     let player_address = contract_address_const::<1>();
    
//     testing::set_caller_address(player_address);
//     contract.join_game(game_id, 123);
//     // Try joining again - should fail
//     contract.join_game(game_id, 123);
// }

// #[test]
// #[should_panic(expected: ('Game already started',))]
// fn test_join_started_game() {
//     let contract = deploy_contract();
//     let game_id = 1;
    
//     // Add 4 players and start game
//     let mut i: u8 = 1;
//     loop {
//         if i > 4 {
//             break;
//         }
//         testing::set_caller_address(contract_address_const::<felt252>::from(i.into()));
//         contract.join_game(game_id, i.into());
//         i += 1;
//     };
    
//     testing::set_caller_address(contract_address_const::<1>());
//     contract.start_game(game_id);
    
//     // Try joining started game - should fail
//     testing::set_caller_address(contract_address_const::<5>());
//     contract.join_game(game_id, 123);
// }

// #[test]
// fn test_start_game() {
//     let contract = deploy_contract();
//     let game_id = 1;
    
//     // Add 4 players
//     let mut i: u8 = 1;
//     loop {
//         if i > 4 {
//             break;
//         }
//         testing::set_caller_address(contract_address_const::<felt252>::from(i.into()));
//         contract.join_game(game_id, i.into());
//         i += 1;
//     };
    
//     // Start game
//     testing::set_caller_address(contract_address_const::<1>());
//     contract.start_game(game_id);
    
//     // Verify game state
//     assert(contract.is_game_started(game_id), 'Game should be started');
//     assert(contract.get_phase(game_id) == 1, 'Should be in phase 1');
//     assert(!contract.is_game_ended(game_id), 'Game shouldn\'t be ended');
// }

// #[test]
// #[should_panic(expected: ('Not enough players',))]
// fn test_start_game_not_enough_players() {
//     let contract = deploy_contract();
//     let game_id = 1;
    
//     // Add only 3 players
//     let mut i: u8 = 1;
//     loop {
//         if i > 3 {
//             break;
//         }
//         testing::set_caller_address(contract_address_const::<felt252>::from(i.into()));
//         contract.join_game(game_id, i.into());
//         i += 1;
//     };
    
//     // Try starting game - should fail
//     testing::set_caller_address(contract_address_const::<1>());
//     contract.start_game(game_id);
// }

// #[test]
// #[should_panic(expected: ('Game already started',))]
// fn test_start_game_twice() {
//     let contract = deploy_contract();
//     let game_id = 1;
    
//     // Add 4 players
//     let mut i: u8 = 1;
//     loop {
//         if i > 4 {
//             break;
//         }
//         testing::set_caller_address(contract_address_const::<felt252>::from(i.into()));
//         contract.join_game(game_id, i.into());
//         i += 1;
//     };
    
//     testing::set_caller_address(contract_address_const::<1>());
//     contract.start_game(game_id);
//     // Try starting again - should fail
//     contract.start_game(game_id);
// }

// /// Helper function to deploy the contract for testing
// fn deploy_contract() -> IMafiaGameDispatcher {
//     let class_hash = declare('MafiaGame');
//     let prepared = prepare(class_hash, ArrayTrait::new());
//     let deployed = deploy(prepared).unwrap();
//     IMafiaGameDispatcher { contract_address: deployed.contract_address }
// }