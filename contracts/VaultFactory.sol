pragma solidity ^0.4.8;

import "./VaultFactoryI.sol";

/////////////////////////////////
// VaultFactory
/////////////////////////////////


/// @dev Creates the Factory contract that creates `vault` contracts, this is
///  the second contract to be deployed when building this system, in solidity
///  if there is no constructor function explicitly in the contract, it is
///  implicitly included and when deploying this contract, that is the function
///  that is called
contract VaultFactory is VaultFactoryI {
    function create(address _baseToken, address _escapeHatchCaller, address _escapeHatchDestination) returns (Vault) {
        Vault v = new Vault(_baseToken, _escapeHatchCaller, _escapeHatchDestination, 0,0,0,0);
        v.changeOwner(msg.sender);
        return v;
    }
}
