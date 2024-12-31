#!/bin/bash

# Ensure the script exits on any error
set -e

# Declare and deploy the contract
echo "Building the contract..."
scarb build

echo "Declaring the contract..."
CLASS_HASH=$(starkli declare target/dev/contracts_MafiaGame.contract_class.json --network=sepolia)


if [ -z "$CLASS_HASH" ]; then
  echo "Failed to extract the class hash from the declare output."
  exit 1
fi

echo "Class hash declared: $CLASS_HASH"

# # Deploy the contract using the extracted class hash
# echo "Deploying the contract with CLASS_HASH: $CLASS_HASH..."
CONTRACT_ADDRESS=$(starkli deploy "$CLASS_HASH" --network=sepolia)

if [ -z "$CONTRACT_ADDRESS" ]; then
  echo "Failed to extract the contract address from the deploy output."
  exit 1
fi

echo "Contract successfully deployed at address: $CONTRACT_ADDRESS"

echo "Writing the contract address to the frontend..."
OUTPUT_FILE="../frontend/contract/address.json"
cat <<EOF > "$OUTPUT_FILE"
{
  "classHash": "$CLASS_HASH",
  "contractAddress": "$CONTRACT_ADDRESS"
}
EOF

echo "Deployment data saved successfully."

