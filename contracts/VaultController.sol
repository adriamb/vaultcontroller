pragma solidity ^0.4.6;

import "../node_modules/vaultcontract/contracts/Vault.sol";

contract VaultController is Owned {

    /// @dev The `Recipient` is an address that is allowed to receive `baseToken`
    ///  from this controller's Vault after `timeLockExpiration` has passed
    struct Recipient {
        uint activationTime;
        address addr;
        string name;
    }

    /// @dev The `Spender` is allowed to initiate transactions to a 'Recipient`
    ///  as long as the transaction does not violate any of the limits in their
    ///  struct and they are `active`
    struct Spender {
        bool active;
        address addr;
        string name;
        uint dailyAmountLimit;        // max amount to be sent out of the `primaryVault` per day (in the smallest unit of `baseToken`)
        uint dailyTxnLimit; // max number of txns from the `primaryVault` per day
        uint txnAmountLimit;  // max amount to be sent from the `primaryVault` per txn (in the smallest unit of `baseToken`)
        uint openingTime;         // 0-86399 earliest moment the `primaryVault` can send funds (in seconds after the start of the UTC day)
        uint closingTime;           // 1-86400 last moment the `primaryVault` can send funds (in seconds after the start of the UTC day)

        uint accTxsInDay;       // var tracking the daily number in the main vault
        uint accAmountInDay;    // var tracking the daily amount transferred in the main vault
        uint dayOfLastTx;       // var tracking the day that the last txn happened

        Recipient[] recipients;  // Array of recipients
        mapping(address => uint) addr2recipientId; // An index of the Recipients' addresses
    }

    Spender[] public spenders;  // Array of spenders
    mapping(address => uint) addr2dpenderId;  // An index of the Spenders' addresses

    VaultController[] public childVaultControllers; // Array of childVaults under this vault
    mapping(address => uint) addr2vaultControllerId;  // An index of the childVaults' addresses

    string public name;
    bool canceled;


    VaultController public parentVaultController; // Controller of the Vault that feeds this Vault (if there is one)
    address public parentVault;                   // Address of the Vault that feeds this Vault (if there is one)
    Vault public primaryVault;     // Vault that is funding all the childVaults

    VaultFactory public vaultFactory;  // the contract that is used to create vaults
    VaultControllerFactory public vaultControllerFactory; // the contract that is used to create vaultControllers

    address public baseToken;          // The address of the token that is used as a store value
                                //  for this contract, 0x0 in case of ether. The token must have the ERC20
                                //  standard `balanceOf()` and `transfer()` functions
    address public escapeHatchCaller;          // the address that can empty all the vaults if there is an issue
    address public escapeHatchDestination;     // the cold wallet

    uint public dailyAmountLimit;        // max amount to be sent out of a Vault per day (in the smallest unit of `baseToken`)
    uint public dailyTxnLimit; // max number of txns from the a Vault per day
    uint public txnAmountLimit;  // max amount to be sent from the `primaryVault` per txn (in the smallest unit of `baseToken`)
    uint public openingTime;         // 0-86399 earliest moment the a Vault can send funds (in seconds after the start of the UTC day)
    uint public closingTime;           // 1-86400 last moment the a Vault can send funds (in seconds after the start of the UTC day)
    uint public highestAcceptableBalance;      // min amount to be held in the a Vault (in the smallest unit of `baseToken`)
    uint public lowestAcceptableBalance;         // max amount to be held in the a Vault (in the smallest unit of `baseToken`)
    uint public whiteListTimelock;

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

    modifier initialized() {
        if (address(primaryVault) == 0) throw;
        _;
    }

    modifier notInitialized() {
        if (address(primaryVault) == 0) throw;
        _;
    }

    modifier notCanceled() {
        if (canceled) throw;
        _;
    }

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
    ///  system; this deploys the primaryVault
    function initialize(
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

        if (address(primaryVault) != 0) throw;

        primaryVault = Vault(vaultFactory.create(baseToken, escapeHatchCaller, escapeHatchDestination));

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



    /// @notice `onlyOwner` Creates a new project vault with the specified parameters,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    /// @return idVault The newly created Project's ID#
    function createVaultController(
        string _name
    ) onlyOwner initialized notCanceled returns (uint) {


        VaultController pc =  VaultController(vaultControllerFactory.create(
            _name,
            vaultFactory,
            baseToken,
            escapeHatchCaller,
            escapeHatchDestination,
            address(primaryVault)
        ));

        childVaultControllers[childVaultControllers.length ++] = pc;
        addr2vaultControllerId[address(pc)] = childVaultControllers.length;

        NewVault(childVaultControllers.length -1);
        return childVaultControllers.length;
    }

    function initializeChildVaultController(
        uint _idVault,
        address _admin,
        uint _dailyAmountLimit,
        uint _dailyTxnLimit,
        uint _txnAmountLimit,
        uint _highestAcceptableBalance,
        uint _lowestAcceptableBalance,
        uint _whiteListTimelock,
        uint _openingTime,
        uint _closingTime
    ) onlyOwner initialized notCanceled {
        if (_idVault >= childVaultControllers.length) throw;
        VaultController pc= childVaultControllers[_idVault];

        // checks. The limits can not be greater than in the parent.
        if (_dailyAmountLimit > dailyAmountLimit) throw;
        if (_dailyTxnLimit > dailyAmountLimit) throw;
        if (_txnAmountLimit > txnAmountLimit) throw;
        if (_whiteListTimelock < whiteListTimelock) throw;
        if (_highestAcceptableBalance > highestAcceptableBalance) throw;
        if (_lowestAcceptableBalance > _highestAcceptableBalance) throw;
        if (_openingTime >= 86400) throw;
        if (_closingTime > 86400) throw;

        pc.initialize(
            _dailyAmountLimit,
            _dailyTxnLimit,
            _txnAmountLimit,
            _highestAcceptableBalance,
            _lowestAcceptableBalance,
            _whiteListTimelock,
            _openingTime,
            _closingTime
        );
        pc.changeOwner(_admin);
    }

    function cancelChildVaultController(uint _idVault) initialized notCanceled onlyOwner {
        if (_idVault >= childVaultControllers.length) throw;
        VaultController pc= childVaultControllers[_idVault];

        pc.cancelVaultController();
    }

    /// @notice `onlyOwner` Cancels a project and empties it's vault into the
    ///  `escapeHatchDestination`
    function cancelVaultController() onlyOwnerOrParent initialized {

        cancelAllChildControllers();

        uint vaultBalance = primaryVault.getBalance();

        if ((vaultBalance > 0) || (!canceled)) {
            primaryVault.authorizePayment(
              "CANCEL CHILD VAULT",
              bytes32(msg.sender),
              address(parentVault),
              vaultBalance,
              0
            );
            canceled = true;
            highestAcceptableBalance = 0;
            lowestAcceptableBalance = 0;
            owner = parentVaultController;
            VaultCanceled(msg.sender);
        }
    }

    /// @notice `onlyOwner` Cancels all projects and empties the vaults into the
    ///  `escapeHatchDestination`
    function cancelAllChildControllers() onlyOwnerOrParent initialized {
        uint i;
        for (i=0; i<childVaultControllers.length; i++) {
            cancelChildVaultController(i);
        }
    }


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

    /// @notice A `childVaultController` calls this function to top up their
    ///  Vault's Balance to the `highestAcceptableBalance`
    uint public test1;

    function topUpVault() initialized notCanceled {
        if (canceled) throw;
        uint idVault = addr2vaultControllerId[msg.sender];
        if (addr2vaultControllerId[msg.sender] == 0) throw;
        idVault--;
        VaultController pc = childVaultControllers[idVault];
        Vault childVault = Vault(pc.primaryVault());
        if (address(childVault) == 0) throw; // Child project is not initialized
        uint vaultBalance = childVault.getBalance();
        if (vaultBalance < pc.lowestAcceptableBalance()) {
            uint transferAmount = pc.highestAcceptableBalance() - vaultBalance;
            if (primaryVault.getBalance() < transferAmount) {
                transferAmount = primaryVault.getBalance();
            }
            if (   checkMainTransfer(pc.primaryVault(), transferAmount)
                && (transferAmount > 0)) {
                primaryVault.authorizePayment(
                  "TOP UP VAULT",
                  bytes32(idVault),
                  address(pc.primaryVault()),
                  transferAmount,
                  0
                );
                TopUpVault(idVault, transferAmount);
            }
        }
    }

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

    /// @notice `onlyProjectAdmin` Creates a new request to fund a project's vault,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    function sendToAuthorizedRecipient(
        string _name,
        bytes32 _reference,
        address _recipient,
        uint _amount
    ) initialized notCanceled {
        uint idSpender = addr2dpenderId[msg.sender];
        if (idSpender == 0) throw;
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


    function addAuthorizeSpender(
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

        addr2dpenderId[_addr] = idSpender+1;

        SpenderAuthorized(idSpender, _addr);
    }

    function removeAuthorizedSpender(address _spender) onlyOwner initialized notCanceled {
        uint idSpender = addr2dpenderId[_spender];
        if (idSpender == 0) throw;
        idSpender--;

        addr2dpenderId[msg.sender] = 0;
        spenders[idSpender].active = false;

        SpenderRemoved(idSpender, _spender);
    }


    /// @notice `onlyProjectAdmin` Adds `_recipient` to the whitelist of
    ///  possible recipients, but the `_recipient` cannot receive until
    ///  `whitelistTimelock` has passed
    /// @param _spender ff
    /// @param _recipient the address to be allowed to receive funds from the specified vault
    /// @param _name Name of the recipient
    function addAuthorizeRecipient(
        address _spender,
        address _recipient,
        string _name
    ) onlyOwner initialized notCanceled {
        uint idSpender = addr2dpenderId[_spender];
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

    /// @notice `onlyProjectAdmin` Removes `_recipient` from the whitelist of
    ///  possible recipients
    /// @param _spender ff
    /// @param _recipient The address to be allowed to receive funds from the specified vault
    function removeAuthorizedRecipient(
        address _spender,
        address _recipient
    ) onlyOwner initialized notCanceled {
        uint idSpender = addr2dpenderId[_spender];
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
        if (spender.accAmountInDay + _amount > spender.dailyAmountLimit) return false;
        if (spender.accTxsInDay >= spender.dailyTxnLimit) return false;
        if (_amount > spender.txnAmountLimit) return false;
        if (timeSinceOpening >= windowTimeLength) return false;

        // Checks that the recipient has waited out the `ProjectWhitelistTimelock`

        uint idRecipient = spender.addr2recipientId[_recipient];
        if (idRecipient == 0) return false; // already unauthorized
        idRecipient--;

        Recipient r = spender.recipients[idRecipient];

        if ((r.activationTime == 0) ||
            (r.activationTime > now))
            return false;

        spender.accAmountInDay += _amount;
        spender.accTxsInDay ++;

        return true;
    }

/////
// Viewers
/////


    /// @notice Makes it easy to see how many projects are fed by the primaryVault
    function numberOfVaults() constant returns (uint) {
        return childVaultControllers.length;
    }

    function numberOfSpenders() constant returns (uint) {
        return spenders.length;
    }


    /// @notice Makes it easy to see how many spenders are allowed in each project
    function getNumberOfRecipients(uint _idSpender) constant
    returns (uint) {
        if (_idSpender >= spenders.length) throw;
        Spender s = spenders[_idSpender];


        return s.recipients.length;
    }

    /// @notice Makes it easy to see when a recipient will be able to receive funds
    function getRecipient(uint _idSpender, uint _idx) constant
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

    // Events
    event SpenderAuthorized(uint indexed idSpender, address indexed spender);
    event SpenderRemoved(uint indexed idSpender, address indexed spender);
    event RecipientAuthorized(uint indexed idSpender, uint indexed idRecipient, address indexed recipient);
    event RecipientRemoved(uint indexed idSpender, uint indexed idRecipient, address indexed recipient);


    event Payment(address indexed recipient, bytes32 indexed reference, uint amount);
    event NewVault(uint indexed idVault);
    event VaultCanceled(address indexed canceler);
    event TopUpVault(uint indexed idVault, uint amount);

    event VaultsLimitChanged();
}

/// @notice Creates its own contract that is called when a new vault needs to be made
contract VaultFactory {
    function create(address _baseToken, address _escapeHatchCaller, address _escapeHatchDestination) returns (address) {
        Vault v = new Vault(_baseToken, _escapeHatchCaller, _escapeHatchDestination, 0,0,0,0);
        v.changeOwner(msg.sender);
        return address(v);
    }
}

contract VaultControllerFactory {
    function create(
        string _name,
        address _vaultFactory,
        address _baseToken,
        address _escapeHatchCaller,
        address _escapeHatchDestination,
        address _parentVault
    ) returns(address) {
        VaultController pc = new VaultController(
            _name,
            _vaultFactory,
            address(this),
            _baseToken,
            _escapeHatchCaller,
            _escapeHatchDestination,
            msg.sender,
            _parentVault
        );
        pc.changeOwner(msg.sender);
        return address(pc);
    }
}
