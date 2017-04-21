pragma solidity ^0.4.8;

import "./VaultControllerFactoryI.sol";

/////////////////////////////////
// VaultControllerFactory
/////////////////////////////////


/// @dev Creates the Factory contract that creates `vaultController` contracts,
///  this is the second contract to be deployed when building this system, in
///  solidity if there is no constructor function explicitly in the contract, it
///  is implicitly included and when deploying this contract, that is the
///  function that is called
contract VaultControllerFactoryI {
    /// @notice Creates  `vaultController` contracts
    /// @param _name Name of the `vaultController` you are deploying
    /// @param _vaultFactory Address of the `vaultFactory` that will create the
    ///  Vaults for this system
    /// @param _baseToken The address of the token that is used as a store value
    ///  for this contract, 0x0 in case of ether. The token must have the ERC20
    ///  standard `balanceOf()` and `transfer()` functions
    /// @param _escapeHatchDestination The address of a safe location (usu
    ///  Multisig) to send the `baseToken` held in this contract
    /// @param _escapeHatchCaller The address of a trusted account or contract
    ///  to call `escapeHatch()` to send the `baseToken` in this contract to the
    ///  `escapeHatchDestination` it would be ideal that `escapeHatchCaller`
    ///  cannot move funds out of `escapeHatchDestination`
    /// @param _parentVault The address that feeds the newly created Vault, often a Vault
    /// @return VaultController The newly created vault controller
    function create(
        string _name,
        address _vaultFactory,
        address _baseToken,
        address _escapeHatchCaller,
        address _escapeHatchDestination,
        address _parentVault
    );
}