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
        uint dailyLimit;        // max amount to be sent out of the `mainVault` per day (in the smallest unit of `baseToken`)
        uint dailyTransactions; // max number of txns from the `mainVault` per day
        uint transactionLimit;  // max amount to be sent from the `mainVault` per txn (in the smallest unit of `baseToken`)
        uint startHour;         // 0-86399 earliest moment the `mainVault` can send funds (in seconds after the start of the UTC day)
        uint endHour;           // 1-86400 last moment the `mainVault` can send funds (in seconds after the start of the UTC day)

        uint accTxsInDay;       // var tracking the daily number in the main vault
        uint accAmountInDay;    // var tracking the daily amount transferred in the main vault
        uint dayOfLastTx;       // var tracking the day that the last txn happened

        Recipient[] recipients;  // Array of recipients
        mapping(address => uint) addr2recipient; // An index of the Recipients' addresses 
    }

    Spender[] public spenders;  // Array of spenders
    mapping(address => uint) addr2spender;  // An index of the Spenders' addresses

    VaultController[] public childProjects; // Array of childVaults under this vault
    mapping(address => uint) addr2project;  // An index of the childVaults' addresses

    string public name;
    bool canceled;


    VaultController public parentVaultController; // Controller of the Vault that feeds this Vault (if there is one)
    address public parentVault;                   // Address of the Vault that feeds this Vault (if there is one)
    Vault public mainVault;     // Vault that is funding all the childVaults

    VaultFactory public vaultFactory;  // the contract that is used to create vaults
    VaultControllerFactory public vaultControllerFactory; // the contract that is used to create vaultControllers

    address public baseToken;          // The address of the token that is used as a store value
                                //  for this contract, 0x0 in case of ether. The token must have the ERC20
                                //  standard `balanceOf()` and `transfer()` functions
    address public escapeHatchCaller;          // the address that can empty all the vaults if there is an issue
    address public escapeHatchDestination;     // the cold wallet

    uint public dailyLimit;        // max amount to be sent out of a Vault per day (in the smallest unit of `baseToken`)
    uint public dailyTransactions; // max number of txns from the a Vault per day
    uint public transactionLimit;  // max amount to be sent from the `mainVault` per txn (in the smallest unit of `baseToken`)
    uint public startHour;         // 0-86399 earliest moment the a Vault can send funds (in seconds after the start of the UTC day)
    uint public endHour;           // 1-86400 last moment the a Vault can send funds (in seconds after the start of the UTC day)
    uint public topThreshold;      // min amount to be held in the a Vault (in the smallest unit of `baseToken`)
    uint public bottomThreshold;         // max amount to be held in the a Vault (in the smallest unit of `baseToken`)
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
        if (msg.sender != parentVaultController) throw;
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
        address _parentVault,               // 0x0 if a `primaryVault`
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _topThreshold,
        uint _bottomThreshold,
        uint _whiteListTimelock
    ) {

        // Initializing all the variables
        vaultFactory = VaultFactory(_vaultFactory);
        vaultControllerFactory = VaultControllerFactory(_vaultControllerFactory);
        baseToken = _baseToken;
        escapeHatchCaller = _escapeHatchCaller;
        escapeHatchDestination = _escapeHatchDestination;
        parentVaultController = VaultController(_parentVaultController);
        parentVault = _parentVault;
        dailyLimit = _dailyLimit;
        dailyTransactions = _dailyTransactions;
        transactionLimit = _transactionLimit;
        topThreshold = _topThreshold;
        bottomThreshold = _bottomThreshold;
        whiteListTimelock = _whiteListTimelock;

        name = _name;
        dailyLimit = maxDailyLimit;
        dailyTransactions = maxDailyTransactions;
        transactionLimit = maxTransactionLimit;
        startHour = 0;                          
        endHour = 86400;
        topThreshold = maxTopThreshold;
        bottomThreshold = maxTopThreshold/10;
        whiteListTimelock = minWhiteListTimelock;
    }

/////////
// Public Methods
/////////

    /// @notice `onlyOwner` Creates the `primaryVault`; this is the fourth and
    ///  final function call that needs to be made to finish deploying this
    ///  system; this deploys the mainVault
    function initialize() onlyOwner {

        if (address(mainVault) != 0) throw;

        mainVault = Vault(vaultFactory.create(baseToken, escapeHatchCaller, escapeHatchDestination));

        // Authorize this contract to spend money from this vault
        mainVault.authorizeSpender(
            address(this),
            "VAULT CONTROLLER",
            0x0
        );

        if (address(parentVaultController) != 0) {
            parentVaultController.refillMe();
        }
    }



    /// @notice `onlyOwner` Creates a new project vault with the specified parameters,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    /// @return idProject The newly created Project's ID#
    function createProject(
        string _name,
        address _admin,
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _topThreshold,
        uint _bottomThreshold,
        uint _whiteListTimelock
    ) onlyOwner returns (uint) {

        // checks. The limits can not be greater than in the parent.
        if (_dailyLimit > dailyLimit) throw;
        if (_dailyTransactions > dailyLimit) throw;
        if (_transactionLimit > transactionLimit) throw;
        if (_whiteListTimelock < whiteListTimelock) throw;


        if (_topThreshold > topThreshold) throw;
        if (_bottomThreshold > _topThreshold) throw;

        VaultController pc =  VaultController(vaultControllerFactory.create(
            _name,
            vaultFactory,
            baseToken,
            escapeHatchCaller,
            escapeHatchDestination,
            address(this),
            address(mainVault),
            _dailyLimit,
            _dailyTransactions,
            _transactionLimit,
            _topThreshold,
            _bottomThreshold,
            _whiteListTimelock
        ));


        childProjects[childProjects.length ++] = pc;
        addr2project[address(pc)] = childProjects.length;

        NewProject(childProjects.length -1);

        pc.initialize();
        pc.changeOwner(_admin);

        return childProjects.length;
    }

    function cancelChildProject(uint _idProject) onlyOwner {
        if (_idProject >= childProjects.length) throw;
        VaultController pc= childProjects[_idProject];

        pc.cancelProject();
    }

    /// @notice `onlyOwner` Cancels a project and empties it's vault into the
    ///  `escapeHatchDestination`
    function cancelProject() onlyOwnerOrParent {

        cancelAllChilds();

        uint projectBalance = mainVault.getBalance();

        if ((projectBalance > 0) || (!canceled)) {
            mainVault.authorizePayment(
              "CANCEL CHILD VAULT",
              bytes32(msg.sender),
              address(parentVault),
              projectBalance,
              0
            );
            canceled = true;
            topThreshold = 0;
            bottomThreshold = 0;
            owner = parentVaultController;
            ProjectCanceled(msg.sender);
        }
    }

    /// @notice `onlyOwner` Cancels all projects and empties the vaults into the
    ///  `escapeHatchDestination`
    function cancelAllChilds() onlyOwnerOrParent {
        uint i;
        for (i=0; i<childProjects.length; i++) {
            cancelChildProject(i);
        }
    }


    function setChildProjectParams(
        uint _idChildProject,
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _startHour,
        uint _endHour,
        uint _whiteListTimelock,
        uint _topThreshold,
        uint _bottomThreshold
    ) onlyOwner {
        if (_idChildProject > childProjects.length) throw;
        VaultController vc = childProjects[_idChildProject];

        if (_dailyLimit > dailyLimit) throw;
        if (_dailyTransactions > dailyLimit) throw;
        if (_transactionLimit > transactionLimit) throw;
        if (_whiteListTimelock < whiteListTimelock) throw;
        if (_topThreshold > topThreshold) throw;
        if (_bottomThreshold > _topThreshold) throw;
        if (_startHour >= 86400) throw;
        if (_endHour > 86400) throw;

        vc.setProjectParams(
            _idChildProject,
            _dailyLimit,
            _dailyTransactions,
            _transactionLimit,
            _startHour,
            _endHour,
            _whiteListTimelock,
            _topThreshold,
            _bottomThreshold
        );
    }


    /// @notice `onlyOwner` Changes the transaction limits to a project's vault,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    function setProjectParams(
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _startHour,
        uint _endHour,
        uint _whiteListTimelock,
        uint _topThreshold,
        uint _bottomThreshold
    ) onlyParent {
        dailyLimit = _dailyLimit;
        dailyTransactions = _dailyTransactions;
        transactionLimit = _transactionLimit;
        startHour = _startHour;
        endHour = _endHour;
        whiteListTimelock = _whiteListTimelock;
        topThreshold = _topThreshold;
        bottomThreshold = _bottomThreshold;

        parentVaultController.refillMe();
        sendBackOverflow();

        ParamsChanged();
    }

    /// @notice A `childVaultController` calls this function to top up their 
    ///  Vault's Balance to the `highestAcceptableBalance`

    uint public test1;

    function refillMe() {
        if (canceled) throw;
        uint idProject = addr2project[msg.sender];
        if (addr2project[msg.sender] == 0) throw;
        idProject--;
        VaultController pc = childProjects[idProject];
        uint projectBalance = Vault(pc.mainVault()).getBalance();
        if (projectBalance < pc.bottomThreshold()) {
            uint transferAmount = pc.topThreshold() - projectBalance;
            if (mainVault.getBalance() < transferAmount) {
                transferAmount = mainVault.getBalance();
            }
            if (   checkMainTransfer(pc.mainVault(), transferAmount)
                && (transferAmount > 0)) {
                mainVault.authorizePayment(
                  "TOP UP VAULT",
                  bytes32(idProject),
                  address(pc.mainVault()),
                  transferAmount,
                  0
                );
                ProjectRefill(idProject, transferAmount);
            }
        }
    }

    function sendBackOverflow() {
        if (mainVault.getBalance() > topThreshold) {
            mainVault.authorizePayment(
              "VAULT OVERFLOW",
              bytes32(0),
              address(parentVault),
              mainVault.getBalance() - topThreshold,
              0
            );
        }
    }

    /// @notice `onlyProjectAdmin` Creates a new request to fund a project's vault,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    function newPayment(
        string _name,
        bytes32 _reference,
        address _recipient,
        uint _amount
    ) {

        uint idSpender = addr2spender[msg.sender];
        if (idSpender == 0) throw;
        idSpender --;
        Spender s = spenders[idSpender];

        if (!checkMainTransfer(_recipient, _amount)) throw;
        if (!checkSpenderTransfer(s, _recipient, _amount)) throw;

        if (address(parentVaultController) != 0) {
            parentVaultController.refillMe();
        }
        sendBackOverflow();

        if (mainVault.getBalance() < _amount ) throw;

        mainVault.authorizePayment(
          _name,
          _reference,
          _recipient,
          _amount,
          0
        );

        if (address(parentVaultController) != 0) {
            parentVaultController.refillMe();
        }
    }


    function authorizeSpender(
        string _name,
        address _addr,
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _startHour,
        uint _endHour
    ) onlyOwner {
        uint idSpender = spenders.length ++;
        Spender s = spenders[idSpender];

        if (_dailyLimit > dailyLimit) throw;
        if (_dailyTransactions > dailyTransactions) throw;
        if (_transactionLimit > transactionLimit) throw;
        if (_startHour >= 86400) throw;
        if (_endHour > 86400) throw;

        s.active = true;
        s.name = _name;
        s.addr = _addr;
        s.dailyLimit = _dailyLimit;
        s.dailyTransactions = _dailyTransactions;
        s.transactionLimit = _transactionLimit;
        s.startHour = _startHour;
        s.endHour = _endHour;

        addr2spender[_addr] = idSpender+1;

        AuthorizedRecipient(idSpender, _addr);
    }

    function unauthorizeSpender(address _spender) {
        uint idSpender = addr2spender[_spender];
        if (idSpender == 0) throw;
        idSpender--;

        addr2spender[msg.sender] = 0;
        spenders[idSpender].active = false;

        UnauthorizeSpender(idSpender, _spender);
    }


    /// @notice `onlyProjectAdmin` Adds `_recipient` to the whitelist of
    ///  possible recipients, but the `_recipient` cannot receive until
    ///  `whitelistTimelock` has passed
    /// @param _spender ff
    /// @param _recipient the address to be allowed to receive funds from the specified vault
    /// @param _name Name of the recipient
    function authorizeRecipient(
        address _spender,
        address _recipient,
        string _name
    ) onlyOwner {
        uint idSpender = addr2spender[_spender];
        if (idSpender == 0) throw;
        idSpender --;
        Spender s = spenders[idSpender];

        if (s.addr2recipient[_recipient]>0) return; // already authorized

        uint idRecipient = s.recipients.length ++;

        s.recipients[idRecipient].name = _name;
        s.recipients[idRecipient].addr = _recipient;
        s.recipients[idRecipient].activationTime = now + whiteListTimelock;

        s.addr2recipient[_recipient] = idRecipient +1;

        AuthorizedRecipient(idSpender, _recipient);
    }

    /// @notice `onlyProjectAdmin` Removes `_recipient` from the whitelist of
    ///  possible recipients
    /// @param _spender ff
    /// @param _recipient The address to be allowed to receive funds from the specified vault
    function unauthorizeRecipient(
        address _spender,
        address _recipient
    ) onlyOwner {
        uint idSpender = addr2spender[_spender];
        if (idSpender == 0) throw;
        idSpender --;
        Spender s = spenders[idSpender];

        uint idRecipient = s.addr2recipient[_recipient];
        if (idRecipient == 0) return; // already unauthorized
        idRecipient--;

        s.recipients[idRecipient].activationTime = 0;
        s.addr2recipient[_recipient] = 0;

        UnauthorizedRecipient(idSpender, _recipient);
    }

//////
// Check Functions
//////


    /// @notice Checks that the transaction limits in the mainVault are followed
    /// called every time the mainVault sends `baseTokens`
    function checkMainTransfer(address _recipient, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;       //Number of days since Jan 1, 1970 (UTC Timezone) fractional remainder discarded
        uint actualHour = now % actualDay;  //Number of seconds since midnight (UTC Timezone)

        if (actualHour < startHour) actualDay--; // adjusts day to start at `mainStartHour`

        uint timeSinceStart = now - (actualDay * 86400 + startHour);

        uint windowTimeLength = endHour >= startHour ?
                                        endHour - startHour :
                                        86400 + endHour - startHour;

        if (canceled) return false;

        // Resets the daily transfer counters
        if (dayOfLastTx < actualDay) {
            accTxsInDay = 0;
            accAmountInDay = 0;
            dayOfLastTx = actualDay;
        }
        // Checks on the transaction limits
        if (accAmountInDay + _amount > dailyLimit) return false;
        if (accTxsInDay >= dailyTransactions) return false;
        if (_amount > transactionLimit) return false;
        if (timeSinceStart >= windowTimeLength) return false;

        // Counting daily transactions and total amount spent in one day
        accAmountInDay += _amount;
        accTxsInDay ++;

        return true;
    }

    /// @notice Checks that the transaction limits in the mainVault are followed
    /// called every time the mainVault sends `baseTokens`
    function checkSpenderTransfer(Spender storage spender, address _recipient, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;       //Number of days since Jan 1, 1970 (UTC Timezone) fractional remainder discarded
        uint actualHour = now % actualDay;  //Number of seconds since midnight (UTC Timezone)

        if (actualHour < spender.startHour) actualDay--; // adjusts day to start at `mainStartHour`

        uint timeSinceStart = now - (actualDay * 86400 + spender.startHour);

        uint windowTimeLength = spender.endHour >= spender.startHour ?
                                        spender.endHour - spender.startHour :
                                        86400 + spender.endHour - spender.startHour;

        // Resets the daily transfer counters
        if (spender.dayOfLastTx < actualDay) {
            spender.accTxsInDay = 0;
            spender.accAmountInDay = 0;
            spender.dayOfLastTx = actualDay;
        }

        // Checks on the transaction limits
        if (spender.accAmountInDay + _amount > spender.dailyLimit) return false;
        if (spender.accTxsInDay >= spender.dailyTransactions) return false;
        if (_amount > spender.transactionLimit) return false;
        if (timeSinceStart >= windowTimeLength) return false;

        // Checks that the recipient has waited out the `ProjectWhitelistTimelock`

        uint idRecipient = spender.addr2recipient[_recipient];
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

    /// @notice Makes it easy to see how many projects are fed by the mainVault
    function numberOfProjects() constant returns (uint) {
        return childProjects.length;
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
    event AuthorizedRecipient(uint indexed idSpender, address indexed recipient);
    event UnauthorizedRecipient(uint indexed idSpender, address indexed recipient);

    event AuthorizeSpender(uint indexed idSpender, address indexed spender);
    event UnauthorizeSpender(uint indexed idSpender, address indexed spender);

    event Payment(address indexed recipient, bytes32 indexed reference, uint amount);
    event NewProject(uint indexed idProject);
    event ProjectCanceled(address indexed canceler);
    event ProjectRefill(uint indexed idProject, uint amount);

    event ParamsChanged();
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
        address _parentVaultController,
        address _parentVault,
        uint _maxDailyLimit,
        uint _maxDailyTransactions,
        uint _maxTransactionLimit,
        uint _maxTopThreshold,
        uint _minWhiteListTimelock
    ) returns(address) {
        VaultController pc = new VaultController(
            _name,
            _vaultFactory,
            address(this),
            _baseToken,
            _escapeHatchCaller,
            _escapeHatchDestination,
            _parentVaultController,
            _parentVault,
            _maxDailyLimit,
            _maxDailyTransactions,
            _maxTransactionLimit,
            _maxTopThreshold,
            _minWhiteListTimelock
        );
        pc.changeOwner(msg.sender);
        return address(pc);
    }
}
