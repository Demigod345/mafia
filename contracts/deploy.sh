#!/bin/bash

# Check if a command is provided
if [ $# -lt 1 ]; then
  echo "Invalid usage. Please use ./script.sh build or ./script.sh deploy <CLASS_HASH>"
  exit 1
fi

# Parse the first argument
COMMAND=$1

# Handle the build command
if [ "$COMMAND" == "build" ]; then
  echo "Building the contract..."
  scarb build
  starkli declare target/dev/contracts_MafiaGame.contract_class.json
  exit 0
fi

# Handle the deploy command
if [ "$COMMAND" == "deploy" ]; then
  if [ $# -lt 2 ]; then
    echo "Invalid usage. Please provide the CLASS_HASH. Example: ./script.sh deploy <CLASS_HASH>"
    exit 1
  fi
  
  CLASS_HASH=$2
  echo "Deploying the contract with CLASS_HASH: $CLASS_HASH..."
  starkli deploy "$CLASS_HASH"
  exit 0
fi

# Handle invalid commands
echo "Invalid usage. Please use ./script.sh build or ./script.sh deploy <CLASS_HASH>"
exit 1
