pragma solidity ^0.4.8;

import "./VaultControllerI.sol";
import "./VaultFactory.sol";
import "./VaultControllerFactoryI.sol";

/////////////////////////////////
// VaultController
/////////////////////////////////

contract VaultController is VaultControllerI {

    uint constant  MAX_GENERATIONS = 10;
    uint constant MAX_CHILDS = 100;

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
        address _parentVault               // NEVER 0x0
    ) {

        // Initializing all the variables
        vaultFactory = VaultFactory(_vaultFactory);
        vaultControllerFactory = VaultControllerFactoryI(_vaultControllerFactory);
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
        openingTime = _openingTime;
        closingTime = _closingTime;

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

        VaultControllerI vc =  vaultControllerFactory.create(
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
        VaultControllerI vc= childVaultControllers[_childVaultId];


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
        VaultControllerI vc= childVaultControllers[_vaultControllerId];

        vc.cancelVault();
    }

    /// @notice `onlyOwnerOrParent` Cancels this controller's Vault and all it's
    /// children, emptying them to the `parentVault`
    function cancelVault() onlyOwnerOrParent initialized returns (bool _finished) {

        if (canceled) return true; //If it is already canceled, just return.

        cancelAllChildVaults();

        if (msg.gas < 200000) return false;

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
        for (i=0; (i<childVaultControllers.length) && (msg.gas >=200000); i++) {
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
        VaultControllerI vc = childVaultControllers[_idChildProject];

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

        if (address(parentVaultController) != 0) {
            parentVaultController.topUpVault();
        }
        sendBackOverflow();

        VaultsLimitChanged(
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
        VaultControllerI vc = childVaultControllers[vaultControllerId];
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

        uint windowTimeLength;
        if ( closingTime >= openingTime ) {
            windowTimeLength = closingTime - openingTime ;
        } else {
            windowTimeLength = 86400 + closingTime - openingTime;
        }

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

        uint windowTimeLength;

        if (spender.closingTime >= spender.openingTime) {
            windowTimeLength = spender.closingTime - spender.openingTime;    
        } else {
            windowTimeLength = 86400 + spender.closingTime - spender.openingTime;
        }

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
 
    function getPrimaryVault() constant returns (Vault) {
        return primaryVault;
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

    event VaultsLimitChanged(
        uint dailyAmountLimit,
        uint dailyTxnLimit,
        uint txnAmountLimit,
        uint openingTime,
        uint closingTime,
        uint whiteListTimelock,
        uint highestAcceptableBalance,
        uint lowestAcceptableBalance
    );
}





