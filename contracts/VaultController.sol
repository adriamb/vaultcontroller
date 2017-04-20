pragma solidity ^0.4.10;

import "../node_modules/vaultcontract/contracts/Vault.sol";



/////////////////////////////////
// VaultController
/////////////////////////////////

contract VaultController is Owned {

    uint constant  MAX_GENERATIONS = 10;
    uint constant MAX_CHILDS = 100;

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

    VaultController[] public childVaultControllers; // Array of childVaults connected to this vault
    mapping(address => uint) addr2vaultControllerId;  // An index of the childVaults' addresses

    string public name;
    bool public canceled;


    VaultController public parentVaultController; // Controller of the Vault that feeds this Vault (if there is one)
    address public parentVault;                   // Address of the Vault that feeds this Vault (if there is one)
    Vault public primaryVault;     // Vault that is funding all the childVaults

    VaultFactory public vaultFactory;  // the contract that is used to create vaults
    VaultControllerFactory public vaultControllerFactory; // the contract that is used to create vaultControllers

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
    uint public highestAcceptableBalance;   // max amount to be held in this Vault (in the smallest unit of `baseToken`)
    uint public lowestAcceptableBalance;    // min amount to be held in this Vault (in the smallest unit of `baseToken`)
    uint public whiteListTimelock;          // the number of seconds a spender has to wait to send funds to a newly added recipient

    uint public accTxsInDay;       // var tracking the daily number in the main vault
    uint public accAmountInDay;    // var tracking the daily amount transferred in the main vault
    uint public dayOfLastTx;       // var tracking the day that the last txn happened

/////////
// Modifiers
/////////

    /// @dev The addresses preassigned as the Owner or Parent are the
    ///  only addresses that can call a function with this modifier
    modifier onlyOwnerOrParent() {
        if (    (msg.sender != owner)
             && (msg.sender != address(parentVaultController)))
           throw;
        _;
    }

    /// @dev The address preassigned as the Parent Vault's Controller is the
    ///  only address that can call a function with this modifier
    modifier onlyParent() {
        if (msg.sender != address(parentVaultController)) throw;
        _;
    }

    /// @dev The functions with this modifier can only be called if the
    ///  `primaryVault` has been created
    modifier initialized() {
        if (address(primaryVault) == 0) throw;
        _;
    }

    /// @dev The functions with this modifier can only be called if the
    ///  `primaryVault` has NOT been created
    modifier notInitialized() {
        if (address(primaryVault) != 0) throw;
        _;
    }

    /// @dev The functions with this modifier can only be called if the
    ///  `primaryVault` has NOT been created
    modifier notCanceled() {
        if (canceled) throw;
        _;
    }

    /// @dev The address preassigned as the Parent (or Owner if there is no
    ///  Parent) is the only address that can call a function with this modifier
    modifier onlyParentOrOwnerIfNoParent() {
        if (address(parentVaultController) == 0) {
            if (msg.sender != owner) throw;
        } else {
            if (msg.sender != address(parentVaultController)) throw;
        }
        _;
    }

/////////
// Constructor
/////////

    /// @notice Deployed after deploying the `vaultFactory` and the
    ///  `vaultControllerFactory`; Creates the `vaultController` for the
    ///  `primaryVault`
    function VaultController(
        string _name,
        address _vaultFactory,
        address _vaultControllerFactory,
        address _baseToken,
        address _escapeHatchCaller,
        address _escapeHatchDestination,
        address _parentVaultController,     // 0x0 if a `primaryVault`
        address _parentVault               // 0x0 if a `primaryVault`
    ) {

        // Initializing all the variables
        vaultFactory = VaultFactory(_vaultFactory);
        vaultControllerFactory = VaultControllerFactory(_vaultControllerFactory);
        baseToken = _baseToken;
        escapeHatchCaller = _escapeHatchCaller;
        escapeHatchDestination = _escapeHatchDestination;
        parentVaultController = VaultController(_parentVaultController);
        parentVault = _parentVault;


        name = _name;
        openingTime = 0;
        closingTime = 86400;
    }

/////////
// Public Methods
/////////

    /// @notice `onlyOwner` Creates the `primaryVault`; this is the fourth and
    ///  final function call that needs to be made to finish deploying this
    ///  system
    function initializeVault(
        uint _dailyAmountLimit,
        uint _dailyTxnLimit,
        uint _txnAmountLimit,
        uint _highestAcceptableBalance,
        uint _lowestAcceptableBalance,
        uint _whiteListTimelock,
        uint _openingTime,
        uint _closingTime
      ) onlyOwner notInitialized notCanceled {

        dailyAmountLimit = _dailyAmountLimit;
        dailyTxnLimit = _dailyTxnLimit;
        txnAmountLimit = _txnAmountLimit;
        highestAcceptableBalance = _highestAcceptableBalance;
        lowestAcceptableBalance = _lowestAcceptableBalance;
        whiteListTimelock = _whiteListTimelock;

        primaryVault = vaultFactory.create(baseToken, escapeHatchCaller, escapeHatchDestination);

        // Authorize this contract to spend money from this vault
        primaryVault.authorizeSpender(
            address(this),
            "VAULT CONTROLLER",
            0x0
        );

        if (address(parentVaultController) != 0) {
            parentVaultController.topUpVault();
        }
    }



    /// @notice `onlyOwner` Creates a new `childVaultController` with the same
    ///  `baseToken`, `escapeHatchCaller`, and `escapeHatchDestination` as this
    ///  'parentVaultController'
    /// @param _name The name for this `childVaultController`
    /// @return vaultControllerId The newly created childVaultController's ID#
    function createChildVault(
        string _name
    )  onlyOwner initialized notCanceled returns (uint) {

        // Limits the maximum hierachal deep for security reasons.
        if (getGeneration() >= MAX_GENERATIONS) throw;

        // Limits the maximum childs for security reasons
        if (childVaultControllers.length >= MAX_CHILDS) throw;

        VaultController vc =  vaultControllerFactory.create(
            _name,
            vaultFactory,
            baseToken,
            escapeHatchCaller,
            escapeHatchDestination,
            address(primaryVault)
        );

        uint childControllerId = childVaultControllers.length ++;
        childVaultControllers[childControllerId] = vc;
        addr2vaultControllerId[address(vc)] = childVaultControllers.length;

        NewVault(childControllerId);
        return childControllerId;
    }

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
    ) onlyOwner initialized notCanceled {
        if (_childVaultId >= childVaultControllers.length) throw;
        VaultController vc= childVaultControllers[_childVaultId];


        // Checks to confirm that the limits are not greater than the `parentVault`
        if (_dailyAmountLimit > dailyAmountLimit) throw;
        if (_dailyTxnLimit > dailyAmountLimit) throw;
        if (_txnAmountLimit > txnAmountLimit) throw;
        if (_whiteListTimelock < whiteListTimelock) throw;
        if (_highestAcceptableBalance > highestAcceptableBalance) throw;
        if (_lowestAcceptableBalance > _highestAcceptableBalance) throw;
        if (_openingTime >= 86400) throw;
        if (_closingTime > 86400) throw;

        vc.initializeVault(
            _dailyAmountLimit,
            _dailyTxnLimit,
            _txnAmountLimit,
            _highestAcceptableBalance,
            _lowestAcceptableBalance,
            _whiteListTimelock,
            _openingTime,
            _closingTime
        );

        vc.changeOwner(_admin);
    }

    /// @notice `onlyOwner` Cancels a childVault; this is called when a
    ///  parentVaultController wants to cancel a childVault
    function cancelChildVault(
        uint _vaultControllerId
        ) initialized notCanceled onlyOwnerOrParent {
        if (_vaultControllerId >= childVaultControllers.length) throw;
        VaultController vc= childVaultControllers[_vaultControllerId];

        vc.cancelVault();
    }

    /// @notice `onlyOwnerOrParent` Cancels this controller's Vault and all it's
    /// children, emptying them to the `parentVault`
    function cancelVault() onlyOwnerOrParent initialized returns (bool _finished) {

        if (canceled) return; //If it is already canceled, just return.

        cancelAllChildVaults();

        if (gas() < 200000) return false;

        uint vaultBalance = primaryVault.getBalance();

        canceled = true;
        highestAcceptableBalance = 0;
        lowestAcceptableBalance = 0;
        owner = parentVaultController;
        if (vaultBalance > 0) {
            primaryVault.authorizePayment(
              "CANCEL CHILD VAULT",
              bytes32(msg.sender),
              address(parentVault),
              vaultBalance,
              0
            );
            VaultCanceled(msg.sender);
        }

        // Be sure that there is nothing remaining in the vault
        if (primaryVault.getBalance() > 0) throw;

        return true;
    }

    /// @notice `onlyOwner` Automates that cancellation of all childVaults
    function cancelAllChildVaults() internal onlyOwnerOrParent initialized {
        uint i;
        for (i=0; (i<childVaultControllers.length) && (gas() >=200000); i++) {
            cancelChildVault(i);
        }
    }

    /// @notice `onlyOwner` Changes the transaction limits to a `childVault`,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying the `parentVault`
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
    ) onlyOwner initialized notCanceled {
        if (_idChildProject > childVaultControllers.length) throw;
        VaultController vc = childVaultControllers[_idChildProject];

        if (_dailyAmountLimit > dailyAmountLimit) throw;
        if (_dailyTxnLimit > dailyAmountLimit) throw;
        if (_txnAmountLimit > txnAmountLimit) throw;
        if (_whiteListTimelock < whiteListTimelock) throw;
        if (_highestAcceptableBalance > highestAcceptableBalance) throw;
        if (_lowestAcceptableBalance > _highestAcceptableBalance) throw;
        if (_openingTime >= 86400) throw;
        if (_closingTime > 86400) throw;

        vc.setVaultLimits(
            _dailyAmountLimit,
            _dailyTxnLimit,
            _txnAmountLimit,
            _openingTime,
            _closingTime,
            _whiteListTimelock,
            _highestAcceptableBalance,
            _lowestAcceptableBalance
        );
    }


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
    ) onlyParentOrOwnerIfNoParent initialized notCanceled {
        if (_lowestAcceptableBalance > _highestAcceptableBalance) throw;

        dailyAmountLimit = _dailyAmountLimit;
        dailyTxnLimit = _dailyTxnLimit;
        txnAmountLimit = _txnAmountLimit;
        openingTime = _openingTime;
        closingTime = _closingTime;
        whiteListTimelock = _whiteListTimelock;
        highestAcceptableBalance = _highestAcceptableBalance;
        lowestAcceptableBalance = _lowestAcceptableBalance;

        parentVaultController.topUpVault();
        sendBackOverflow();

        VaultsLimitChanged();
    }

    uint public test1; // for testing
    uint public test2; // for testing
    uint public test3; // for testing
    uint public test4; // for testing
    uint public test5; // for testing

    /// @notice A `childVaultController` calls this function to top up their
    ///  Vault's Balance to the `highestAcceptableBalance`
    function topUpVault() initialized notCanceled {
        uint vaultControllerId = addr2vaultControllerId[msg.sender];
        if (addr2vaultControllerId[msg.sender] == 0) throw;
        vaultControllerId--;
        VaultController vc = childVaultControllers[vaultControllerId];
        Vault childVault = Vault(vc.primaryVault());
        if (address(childVault) == 0) throw; // Child project is not initialized

        uint vaultBalance = childVault.getBalance();
        if (vaultBalance < vc.lowestAcceptableBalance()) {
            uint transferAmount = vc.highestAcceptableBalance() - vaultBalance;
            if (primaryVault.getBalance() < transferAmount) {
                transferAmount = primaryVault.getBalance();
            }
            if (   checkMainTransfer(vc.primaryVault(), transferAmount)
                && (transferAmount > 0)) {
                primaryVault.authorizePayment(
                  "TOP UP VAULT",
                  bytes32(vaultControllerId),
                  address(vc.primaryVault()),
                  transferAmount,
                  0
                );
                TopUpVault(vaultControllerId, transferAmount);
            }
        }
    }


    /// @notice A `childVaultController` calls this function to reduce their
    ///  Vault's Balance to the `highestAcceptableBalance`
    function sendBackOverflow() {
        if (primaryVault.getBalance() > highestAcceptableBalance) {
            primaryVault.authorizePayment(
              "VAULT OVERFLOW",
              bytes32(0),
              address(parentVault),
              primaryVault.getBalance() - highestAcceptableBalance,
              0
            );
        }
    }

    /// @notice Only called by authorized `spenders[]` Creates a new request to
    ///  transfer `baseTokens` to an authorized `recipient`; it will fail if any
    ///  of the parameters are not within the ranges predetermined when
    ///  deploying this contract
    function sendToAuthorizedRecipient(
        string _name,
        bytes32 _reference,
        address _recipient,
        uint _amount
    ) initialized notCanceled {
        uint idSpender = addr2spenderId[msg.sender];
        if (idSpender == 0) throw;
        // addr2spenderId stores the position in the array relative to 1
        // so we subtract one to make it relative to 0.
        idSpender --;
        Spender s = spenders[idSpender];

        if (!checkMainTransfer(_recipient, _amount)) throw;
        if (!checkSpenderTransfer(s, _recipient, _amount)) throw;

        if (address(parentVaultController) != 0) {
            parentVaultController.topUpVault();
        }
        sendBackOverflow();

        if (primaryVault.getBalance() < _amount ) throw;

        primaryVault.authorizePayment(
          _name,
          _reference,
          _recipient,
          _amount,
          0
        );

        if (address(parentVaultController) != 0) {
            parentVaultController.topUpVault();
        }
    }

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
    ) onlyOwner initialized notCanceled {
        uint idSpender = spenders.length ++;
        Spender s = spenders[idSpender];

        if (_dailyAmountLimit > dailyAmountLimit) throw;
        if (_dailyTxnLimit > dailyTxnLimit) throw;
        if (_txnAmountLimit > txnAmountLimit) throw;
        if (_openingTime >= 86400) throw;
        if (_closingTime > 86400) throw;

        s.active = true;
        s.name = _name;
        s.addr = _addr;
        s.dailyAmountLimit = _dailyAmountLimit;
        s.dailyTxnLimit = _dailyTxnLimit;
        s.txnAmountLimit = _txnAmountLimit;
        s.openingTime = _openingTime;
        s.closingTime = _closingTime;

        addr2spenderId[_addr] = idSpender+1;

        SpenderAuthorized(idSpender, _addr);
    }

    /// @notice `onlyOwner` Removes `_spender` from the whitelist
    function removeAuthorizedSpender(address _spender) onlyOwner initialized notCanceled {
        uint idSpender = addr2spenderId[_spender];
        if (idSpender == 0) throw;
        idSpender--;

        addr2spenderId[msg.sender] = 0;
        spenders[idSpender].active = false;

        SpenderRemoved(idSpender, _spender);
    }


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
    ) onlyOwner initialized notCanceled {
        uint idSpender = addr2spenderId[_spender];
        if (idSpender == 0) throw;
        idSpender --;
        Spender s = spenders[idSpender];

        if (s.addr2recipientId[_recipient]>0) return; // already authorized

        uint idRecipient = s.recipients.length ++;

        s.recipients[idRecipient].name = _name;
        s.recipients[idRecipient].addr = _recipient;
        s.recipients[idRecipient].activationTime = now + whiteListTimelock;

        s.addr2recipientId[_recipient] = idRecipient +1;

        RecipientAuthorized(idSpender, idRecipient, _recipient);
    }

    /// @notice `onlyOwner` Removes `_recipient` from the whitelist of
    ///  recipients for a given `_spender`
    /// @param _spender The address that will no longer be allowed to send to
    ///  the `_recipient`
    /// @param _recipient The address that will no longer be allowed to receive
    ///  funds from the `_spender`
    function removeAuthorizedRecipient(
        address _spender,
        address _recipient
    ) onlyOwner initialized notCanceled {
        uint idSpender = addr2spenderId[_spender];
        if (idSpender == 0) throw;
        idSpender --;
        Spender s = spenders[idSpender];

        uint idRecipient = s.addr2recipientId[_recipient];
        if (idRecipient == 0) return; // already unauthorized
        idRecipient--;

        s.recipients[idRecipient].activationTime = 0;
        s.addr2recipientId[_recipient] = 0;

        RecipientRemoved(idSpender, idRecipient, _recipient);
    }

//////
// Check Functions
//////


    /// @notice Checks that the transaction limits in the primaryVault are followed
    ///  called every time the primaryVault sends `baseTokens`
    function checkMainTransfer(address _recipient, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;       //Number of days since Jan 1, 1970 (UTC Timezone) fractional remainder discarded
        uint actualTime = now % actualDay;  //Number of seconds since midnight (UTC Timezone)

        if (actualTime < openingTime) actualDay--; // adjusts day to start at `mainopeningTime`

        uint timeSinceOpening = now - (actualDay * 86400 + openingTime);

        uint windowTimeLength = closingTime >= openingTime ?
                                        closingTime - openingTime :
                                        86400 + closingTime - openingTime;

        if (canceled) return false;

        // Resets the daily transfer counters
        if (dayOfLastTx < actualDay) {
            accTxsInDay = 0;
            accAmountInDay = 0;
            dayOfLastTx = actualDay;
        }
        // Checks on the transaction limits
        if (accAmountInDay + _amount < accAmountInDay) throw; // Overflow
        if (accAmountInDay + _amount > dailyAmountLimit) return false;
        if (accTxsInDay >= dailyTxnLimit) return false;
        if (_amount > txnAmountLimit) return false;
        if (timeSinceOpening >= windowTimeLength) return false;

        // Counting daily transactions and total amount spent in one day
        accAmountInDay += _amount;
        accTxsInDay ++;

        return true;
    }

    /// @notice Checks that the transaction limits in the primaryVault are followed
    ///  called every time the primaryVault sends `baseTokens`
    function checkSpenderTransfer(Spender storage spender, address _recipient, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;       //Number of days since Jan 1, 1970 (UTC Timezone) fractional remainder discarded
        uint actualTime = now % actualDay;  //Number of seconds since midnight (UTC Timezone)

        if (actualTime < spender.openingTime) actualDay--; // adjusts day to start at `mainopeningTime`

        uint timeSinceOpening = now - (actualDay * 86400 + spender.openingTime);

        uint windowTimeLength = spender.closingTime >= spender.openingTime ?
                                        spender.closingTime - spender.openingTime :
                                        86400 + spender.closingTime - spender.openingTime;

        // Resets the daily transfer counters
        if (spender.dayOfLastTx < actualDay) {
            spender.accTxsInDay = 0;
            spender.accAmountInDay = 0;
            spender.dayOfLastTx = actualDay;
        }

        // Checks on the transaction limits
        if (spender.accAmountInDay + _amount < spender.accAmountInDay) throw; // Overflow
        if (spender.accAmountInDay + _amount > spender.dailyAmountLimit) return false;
        if (spender.accTxsInDay >= spender.dailyTxnLimit) return false;
        if (_amount > spender.txnAmountLimit) return false;
        if (timeSinceOpening >= windowTimeLength) return false;


        // Checks that the recipient has waited out the `ProjectWhitelistTimelock`

        uint idRecipient = spender.addr2recipientId[_recipient];
        if (idRecipient == 0) return false; // already unauthorized
        idRecipient--;

        Recipient r = spender.recipients[idRecipient];


        if (r.activationTime == 0) {
            return false;
        }

        if (now < r.activationTime) {
            return false;
        }


        spender.accAmountInDay += _amount;
        spender.accTxsInDay ++;

        return true;
    }

/////
// Viewers
/////


    /// @notice Makes it easy to see how many childVaults are fed by the this Vault
    function numberOfChildVaults() constant returns (uint) {
        return childVaultControllers.length;
    }

    /// @notice Makes it easy to see how many different spenders are allowed to
    ///  use this Vault
    function numberOfSpenders() constant returns (uint) {
        return spenders.length;
    }

    /// @notice Makes it easy to see how many recipients are allowed to receive
    ///  funds from `_idSpender`
    function numberOfRecipients(uint _idSpender) constant
    returns (uint) {
        if (_idSpender >= spenders.length) throw;
        Spender s = spenders[_idSpender];

        return s.recipients.length;
    }

    /// @notice Makes it easy to see when a recipient will be able to receive funds
    function recipients(uint _idSpender, uint _idx) constant
    returns (
            uint _activationTime,
            string _name,
            address _addr
    ) {
        if (_idSpender >= spenders.length) throw;
        Spender s = spenders[_idSpender];


        if (_idx >= s.recipients.length) throw;
        _activationTime = s.recipients[_idx].activationTime;
        _name = s.recipients[_idx].name;
        _addr = s.recipients[_idx].addr;
    }

    function getGeneration() constant returns (uint) {
        if (address(parentVaultController) != 0) {
            return parentVaultController.getGeneration() + 1;
        } else {
            return 1;
        }
    }

    // Internal function to return the remaining gas
    function gas() internal constant returns (uint _gas) {
        assembly {
            _gas:= gas
        }
    }

    // Events
    event SpenderAuthorized(uint indexed idSpender, address indexed spender);
    event SpenderRemoved(uint indexed idSpender, address indexed spender);
    event RecipientAuthorized(uint indexed idSpender, uint indexed idRecipient, address indexed recipient);
    event RecipientRemoved(uint indexed idSpender, uint indexed idRecipient, address indexed recipient);

    event Payment(address indexed recipient, bytes32 indexed reference, uint amount);
    event NewVault(uint indexed vaultControllerId);
    event VaultCanceled(address indexed canceler);
    event TopUpVault(uint indexed vaultControllerId, uint amount);

    event VaultsLimitChanged();
}


/////////////////////////////////
// VaultFactory
/////////////////////////////////


/// @dev Creates the Factory contract that creates `vault` contracts, this is
///  the second contract to be deployed when building this system, in solidity
///  if there is no constructor function explicitly in the contract, it is
///  implicitly included and when deploying this contract, that is the function
///  that is called
contract VaultFactory {
    function create(address _baseToken, address _escapeHatchCaller, address _escapeHatchDestination) returns (Vault) {
        Vault v = new Vault(_baseToken, _escapeHatchCaller, _escapeHatchDestination, 0,0,0,0);
        v.changeOwner(msg.sender);
        return v;
    }
}


/////////////////////////////////
// VaultControllerFactory
/////////////////////////////////


/// @dev Creates the Factory contract that creates `vaultController` contracts,
///  this is the second contract to be deployed when building this system, in
///  solidity if there is no constructor function explicitly in the contract, it
///  is implicitly included and when deploying this contract, that is the
///  function that is called
contract VaultControllerFactory {
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
    /// @param _parentVault The Vault that feeds the newly created Vault
    /// @return VaultController The newly created vault controller
    function create(
        string _name,
        address _vaultFactory,
        address _baseToken,
        address _escapeHatchCaller,
        address _escapeHatchDestination,
        address _parentVault
    ) returns(VaultController) {
        VaultController vc = new VaultController(
            _name,
            _vaultFactory,
            address(this),
            _baseToken,
            _escapeHatchCaller,
            _escapeHatchDestination,
            msg.sender,
            _parentVault
        );
        vc.changeOwner(msg.sender);
        return vc;
    }
}
