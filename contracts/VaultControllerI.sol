pragma solidity ^0.4.8;

import "./VaultFactoryI.sol";
import "./VaultControllerFactoryI.sol";

/////////////////////////////////
// VaultController
/////////////////////////////////

contract VaultControllerI is Owned {

    function VaultController(
        string _name,
        address _vaultFactory,
        address _vaultControllerFactory,
        address _baseToken,
        address _escapeHatchCaller,
        address _escapeHatchDestination,
        address _parentVaultController,     // 0x0 if a `primaryVault`
        address _parentVault               // NEVER 0x0
    );

    function initializeVault(
        uint _dailyAmountLimit,
        uint _dailyTxnLimit,
        uint _txnAmountLimit,
        uint _highestAcceptableBalance,
        uint _lowestAcceptableBalance,
        uint _whiteListTimelock,
        uint _openingTime,
        uint _closingTime
    );


    function createChildVault(
        string _name
    ) returns (uint);

    /// @notice `onlyOwner` Creates a new `childVault` with the specified
    ///  parameters, will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this `parentVaultController` contract
    function initializeChildVault(
        uint _childVaultId,
        address _admin,         // the owner of this `childVaultController`
        uint _dailyAmountLimit,
        uint _dailyTxnLimit,
        uint _txnAmountLimit,
        uint _highestAcceptableBalance,
        uint _lowestAcceptableBalance,
        uint _whiteListTimelock,
        uint _openingTime,
        uint _closingTime
    );

    /// @notice `onlyOwner` Cancels a childVault; this is called when a
    ///  parentVaultController wants to cancel a childVault
    function cancelChildVault(
        uint _vaultControllerId
    );

    /// @notice `onlyOwnerOrParent` Cancels this controller's Vault and all it's
    /// children, emptying them to the `parentVault`
    function cancelVault()returns (bool _finished);

    function setChildVaultLimits(
        uint _idChildProject,
        uint _dailyAmountLimit,
        uint _dailyTxnLimit,
        uint _txnAmountLimit,
        uint _openingTime,
        uint _closingTime,
        uint _whiteListTimelock,
        uint _highestAcceptableBalance,
        uint _lowestAcceptableBalance
    );


    /// @notice `onlyOwner` Changes the transaction limits to a project's vault,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    function setVaultLimits(
        uint _dailyAmountLimit,
        uint _dailyTxnLimit,
        uint _txnAmountLimit,
        uint _openingTime,
        uint _closingTime,
        uint _whiteListTimelock,
        uint _highestAcceptableBalance,
        uint _lowestAcceptableBalance
    );

    /// @notice A `childVaultController` calls this function to top up their
    ///  Vault's Balance to the `highestAcceptableBalance`
    function topUpVault();

    /// @notice A `childVaultController` calls this function to reduce their
    ///  Vault's Balance to the `highestAcceptableBalance`
    function sendBackOverflow();

    /// @notice Only called by authorized `spenders[]` Creates a new request to
    ///  transfer `baseTokens` to an authorized `recipient`; it will fail if any
    ///  of the parameters are not within the ranges predetermined when
    ///  deploying this contract
    function sendToAuthorizedRecipient(
        string _name,
        bytes32 _reference,
        address _recipient,
        uint _amount
    );

    /// @notice `onlyOwner` Authorizes `spender` to create transactions
    ///  transferring `baseTokens` out of this Controller's Vault to an authorized
    ///  `_recipient` that has waited out the `whitelistTimelock`
    function authorizeSpender(
        string _name,
        address _addr,
        uint _dailyAmountLimit,
        uint _dailyTxnLimit,
        uint _txnAmountLimit,
        uint _openingTime,
        uint _closingTime
    );

    /// @notice `onlyOwner` Removes `_spender` from the whitelist
    function removeAuthorizedSpender(address _spender);


    /// @notice `onlyOwner` Adds `_recipient` to the whitelist of
    ///  possible recipients, but the `_recipient` cannot receive until
    ///  `whitelistTimelock` has passed
    /// @param _spender The address that can initiate the transaction to this
    ///  `_recipient`
    /// @param _recipient the address to be allowed to receive funds from the specified vault
    /// @param _name Name of the recipient
    function authorizeRecipient(
        address _spender,
        address _recipient,
        string _name
    );

    /// @notice `onlyOwner` Removes `_recipient` from the whitelist of
    ///  recipients for a given `_spender`
    /// @param _spender The address that will no longer be allowed to send to
    ///  the `_recipient`
    /// @param _recipient The address that will no longer be allowed to receive
    ///  funds from the `_spender`
    function removeAuthorizedRecipient(
        address _spender,
        address _recipient
    );


    /// @notice Makes it easy to see how many childVaults are fed by the this Vault
    function numberOfChildVaults() constant returns (uint);

    /// @notice Makes it easy to see how many different spenders are allowed to
    ///  use this Vault
    function numberOfSpenders() constant returns (uint);

    /// @notice Makes it easy to see how many recipients are allowed to receive
    ///  funds from `_idSpender`
    function numberOfRecipients(uint _idSpender) constant
    returns (uint);

    /// @notice Makes it easy to see when a recipient will be able to receive funds
    function recipients(uint _idSpender, uint _idx) constant
    returns (
            uint _activationTime,
            string _name,
            address _addr
    ) ;

    function getGeneration() constant returns (uint);

}


