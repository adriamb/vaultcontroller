pragma solidity ^0.4.8;

import "../node_modules/vaultcontract/contracts/Vault.sol";
import "./VaultFactoryI.sol";
import "./VaultControllerFactoryI.sol";

/////////////////////////////////
// VaultController
/////////////////////////////////

contract VaultControllerI is Owned {

    /// @dev The `Recipient` is an address that is allowed to receive `baseToken`
    ///  from this controller's Vault after `timeLockExpiration` has passed
    struct Recipient {
        uint activationTime; // the first moment they can start receiving funds
        address addr;
        string name;
    }

    /// @dev The `Spender` is allowed to initiate transactions to a 'Recipient`
    ///  as long as the transaction does not violate any of the limits in their
    ///  struct and they are `active`
    struct Spender {
        bool active;            // True if this spender is authorized to make payments
        string name;
        address addr;
        uint dailyAmountLimit;  // max amount able to be sent out of the Vault by this spender (in the smallest unit of `baseToken`)
        uint dailyTxnLimit;     // max number of txns from the Vault per day by this spender
        uint txnAmountLimit;    // max amount to be sent from the Vault per day by this spender (in the smallest unit of `baseToken`)
        uint openingTime;       // 0-86399 earliest moment the spender can send funds (in seconds after the start of the UTC day)
        uint closingTime;       // 1-86400 last moment the spender can send funds (in seconds after the start of the UTC day)

        uint accTxsInDay;       // var tracking the daily number in the main vault
        uint accAmountInDay;    // var tracking the daily amount transferred in the main vault
        uint dayOfLastTx;       // var tracking the day that the last txn happened

        Recipient[] recipients;  // Array of recipients the spender can send to
        mapping(address => uint) addr2recipientId; // An index of the Recipients' addresses
    }

    Spender[] public spenders;  // Array of spenders that can request payments from this vault
    mapping(address => uint) addr2spenderId;  // An index of the Spenders' addresses

    VaultControllerI[] public childVaultControllers; // Array of childVaults connected to this vault
    mapping(address => uint) addr2vaultControllerId;  // An index of the childVaults' addresses

    string public name;
    bool public canceled;

    VaultControllerI public parentVaultController; // Controller of the Vault that feeds this Vault (if there is one)
    address public parentVault;                   // Address that feeds this Vault, and recieves money when this Vault overflows 

    VaultFactoryI public vaultFactory;  // the contract that is used to create vaults
    VaultControllerFactoryI public vaultControllerFactory; // the contract that is used to create vaultControllers

    address public baseToken;   // The address of the token that is used as a store value
                                //  for this contract, 0x0 in case of ether. The token must have the ERC20
                                //  standard `balanceOf()` and `transfer()` functions
    address public escapeHatchCaller;          // the address that can empty the vault if there is an issue
    address public escapeHatchDestination;     // the cold wallet

    uint public dailyAmountLimit;           // max amount to be sent out of this Vault per day (in the smallest unit of `baseToken`)
    uint public dailyTxnLimit;              // max number of txns from the this Vault per day
    uint public txnAmountLimit;             // max amount to be sent from this Vault per txn (in the smallest unit of `baseToken`)
    uint public openingTime;                // 0-86399 earliest moment funds can be spent (in seconds after the start of the UTC day)
    uint public closingTime;                // 1-86400 last moment funds can be spent (in seconds after the start of the UTC day)
    uint public whiteListTimelock;          // the number of seconds a spender has to wait to send funds to a newly added recipient

    uint public accTxsInDay;       // var tracking the daily number in the main vault
    uint public accAmountInDay;    // var tracking the daily amount transferred in the main vault
    uint public dayOfLastTx;       // var tracking the day that the last txn happened


    uint  public lowestAcceptableBalance;    // min amount to be held in this Vault (in the smallest unit of `baseToken`)
    uint  public highestAcceptableBalance;   // max amount to be held in this Vault (in the smallest unit of `baseToken`)
    Vault public primaryVault;     // Vault that is funding all the childVaults

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


