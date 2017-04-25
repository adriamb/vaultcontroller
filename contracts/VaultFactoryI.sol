pragma solidity ^0.4.8;

import "../node_modules/vaultcontract/contracts/Vault.sol";

/////////////////////////////////
// VaultFactory
/////////////////////////////////


/// @dev Creates the Factory contract that creates `vault` contracts, this is
///  the second contract to be deployed when building this system, in solidity
///  if there is no constructor function explicitly in the contract, it is
///  implicitly included and when deploying this contract, that is the function
///  that is called
contract VaultFactoryI {
    function create(address _baseToken, address _escapeHatchCaller, address _escapeHatchDestination) returns (Vault);
}
