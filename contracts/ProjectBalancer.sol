pragma solidity ^0.4.6;

import "../node_modules/vaultcontract/contracts/Vault.sol";

contract ProjectBalancer is Owned {

    /// @dev mapping of the transactions that have been authorized (not
    ///  necessarily completed)
    struct Authorization {
        uint idx;               // address in the map relative to 1
        uint activationTime;    // UNIX time that the authorization occurred
        string name;
    }
    /// @dev information on each project that the mainVault financially supports
    struct Project {
        string name;        // project name for reference
        address admin;      // address of project admin (usu a Multisig)
        Vault vault;        // project's vault

        uint dailyLimit;        // max amount to be sent per day (in the smallest unit of `baseToken`)
        uint dailyTransactions; // max number of txns per day
        uint transactionLimit;  // max amount to be sent per txn (in the smallest unit of `baseToken`)
        uint startHour;         // 0-86399 earliest moment the project can receive funds (in seconds after the start of the UTC day)
        uint endHour;           // 1-86400 last moment the project can receive funds (in seconds after the start of the UTC day)
        uint bottomThreshold;   // min amount to be held in a projects vault (in the smallest unit of `baseToken`)
        uint topThreshold;      // max amount to be held in a projects vault (in the smallest unit of `baseToken`)
        uint whitelistTimelock; // how long a recipient has to have been on a project's whitelist before they can receive funds (in seconds)
        mapping (address => Authorization) authorizations; // list of authorized txns and the time they occurred
        address[] authorizationAddrs;  // ______________TODO________________

        bool canceled;          // true if the project has been canceled

        uint accTxsInDay;       // counter tracking how many txns have happened in the most recent day that there were txns
        uint accAmountInDay;    // counter tracking how much has been transfered (in the smallest unit of `baseToken`) in the most recent day that there were txns
        uint dayOfLastTx;       // var tracking the last day that a txn was made
    }

    Project[] projects;

    Vault public mainVault;     // the vault that is funding all the project vaults

    VaultFactory public vaultFactory;  // the contract that is used to create vaults

    address public baseToken;          // The address of the token that is used as a store value
                                //  for this contract, 0x0 in case of ether. The token must have the ERC20
                                //  standard `balanceOf()` and `transfer()` functions
    address public escapeHatchCaller;          // the address that can empty all the vaults if there is an issue
    address public escapeHatchDestination;     // the cold wallet

    uint public mainDailyLimit;        // max amount to be sent out of the `mainVault` per day (in the smallest unit of `baseToken`)
    uint public mainDailyTransactions; // max number of txns from the `mainVault` per day
    uint public mainTransactionLimit;  // max amount to be sent from the `mainVault` per txn (in the smallest unit of `baseToken`)
    uint public mainStartHour;         // 0-86399 earliest moment the `mainVault` can send funds (in seconds after the start of the UTC day)
    uint public mainEndHour;           // 1-86400 last moment the `mainVault` can send funds (in seconds after the start of the UTC day)
    uint public mainVaultBottomThreshold;      // min amount to be held in the `mainVault` (in the smallest unit of `baseToken`)
    uint public mainVaultTopThreshold;         // max amount to be held in the `mainVault` (in the smallest unit of `baseToken`)

    uint public maxProjectDailyLimit;          // absolute max amount to be sent out of any project's vault per day (in the smallest unit of `baseToken`)
    uint public maxProjectDailyTransactions;   // absolute max number of txns per day for any project's vault
    uint public maxProjectTransactionLimit;    // absolute max amount to be sent per txn for any project's vault (in the smallest unit of `baseToken`)
    uint public maxProjectTopThreshold;        // absolute max amount to be held in a project's vault (in the smallest unit of `baseToken`)
    uint public minProjectWhitelistTimelock;   // absolute min number of seconds a recipient has to have been on a project's whitelist before they can receive funds


    uint public mainAccTxsInDay;       // var tracking the daily number in the main vault
    uint public mainAccAmountInDay;    // var tracking the daily amount transferred in the main vault
    uint public mainDayOfLastTx;       // var tracking the day that the last txn happened

/////////
// Constructor
/////////

    function ProjectBalancer(
        address _vaultFactory,
        address _baseToken,
        address _escapeHatchCaller,
        address _escapeHatchDestination,
        uint _mainDailyLimit,
        uint _mainDailyTransactions,
        uint _mainTransactionLimit,
        uint _mainStartHour,
        uint _mainEndHour,
        uint _mainVaultBottomThreshold,
        uint _mainVaultTopThreshold,
        uint _maxProjectDailyLimit,
        uint _maxProjectDailyTransactions,
        uint _maxProjectTransactionLimit,
        uint _maxProjectTopThreshold,
        uint _minProjectWhitelistTimelock
    ) {
        vaultFactory = VaultFactory(_vaultFactory);     // vaultFactory is deployed first
        baseToken = _baseToken;
        escapeHatchCaller = _escapeHatchCaller;
        escapeHatchDestination = _escapeHatchDestination;
        mainDailyLimit = _mainDailyLimit;
        mainDailyTransactions = _mainDailyTransactions;
        mainTransactionLimit = _mainTransactionLimit;
        mainStartHour = _mainStartHour;
        mainEndHour = _mainEndHour;
        mainVaultBottomThreshold = _mainVaultBottomThreshold;
        mainVaultTopThreshold = _mainVaultTopThreshold;
        maxProjectDailyLimit = _maxProjectDailyLimit;
        maxProjectDailyTransactions = _maxProjectDailyTransactions;
        maxProjectTransactionLimit = _maxProjectTransactionLimit;
        maxProjectTopThreshold = _maxProjectTopThreshold;
        minProjectWhitelistTimelock = _minProjectWhitelistTimelock;
    }

    /// @notice creates the vault this is the second function cal that needs t be made
    function initialize() onlyOwner {

        if (address(mainVault) != 0) throw;

        mainVault = Vault(vaultFactory.createVault(baseToken, escapeHatchCaller, escapeHatchDestination));

        mainVault.authorizeSpender(
            address(this),
            "Project Balancer",
            0x0
        );
    }

    /// @dev The addresses preassigned as the Owner or Project Admin are the
    ///  only addresses that can call a function with this modifier
    modifier onlyOwnerOrProjectAdmin(uint idProject) {
        if (    (idProject < projects.length)
             || (    (projects[idProject].admin != msg.sender)
                  && (owner != msg.sender)))
           throw;
        _;
    }

    /// @dev The address preassigned as the Project Admin is the
    ///  only address that can call a function with this modifier
    modifier onlyProjectAdmin(uint idProject) {
        if (   (idProject < projects.length)
            || (projects[idProject].admin != msg.sender))
           throw;
        _;
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
        uint _startHour,      // 0-86399   (Seconds since start of the UTC day)
        uint _endHour,
        uint _topThreshold,
        uint _bottomThreshold,
        uint _whitelistTimelock
    ) onlyOwner returns (uint) {
        uint idProject = projects.length++;
        Project project = projects[idProject];

        // checks
        if (_dailyLimit > maxProjectDailyLimit) throw;
        if (_dailyTransactions > maxProjectDailyTransactions) throw;
        if (_transactionLimit > maxProjectTransactionLimit) throw;
        if (_startHour >= 86400) throw;
        if (_endHour > 86400) throw;
        if (_whitelistTimelock < minProjectWhitelistTimelock) throw;

        if (_topThreshold > maxProjectTopThreshold) throw;
        if (_bottomThreshold > _topThreshold) throw;

        project.name = _name;
        project.admin = _admin;
        project.vault = Vault( vaultFactory.createVault(baseToken, escapeHatchCaller, escapeHatchDestination));
        project.vault.authorizeSpender(
            address(this),
            "Project Balancer",
            bytes32(idProject)
        );
        project.dailyLimit = _dailyLimit;
        project.dailyTransactions = _dailyTransactions;
        project.transactionLimit = _transactionLimit;
        project.startHour = _startHour;
        project.endHour = _endHour;
        project.whitelistTimelock = _whitelistTimelock;
        project.bottomThreshold = _bottomThreshold;
        project.topThreshold = _topThreshold;

        NewProject(idProject);

        // Do the initial transfer

        rebalanceProjectHoldings(idProject);
        return idProject;
    }

    /// @notice `onlyOwner` Cancels a project and empties it's vault into the
    ///  `escapeHatchDestination`
    function cancelProject(uint _idProject) onlyOwner {

        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        uint projectBalance = project.vault.getBalance();

        if ((projectBalance > 0) || (!project.canceled)) {
            project.vault.authorizePayment(
              "CANCEL PROJECT",
              bytes32(_idProject),
              address(escapeHatchDestination),
              project.vault.getBalance(),
              0
            );
            project.canceled = true;
            project.topThreshold = 0;
            project.bottomThreshold = 0;
            ProjectCanceled(_idProject);
        }
    }

    /// @notice `onlyOwner` Cancels all projects and empties the vaults into the
    ///  `escapeHatchDestination`
    function cancelAll() onlyOwner {
        uint i;
        for (i=0; i<projects.length; i++) {
            cancelProject(i);
        }
    }


    /// @notice `onlyOwner` Changes the transaction limits to a project's vault,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    function setProjectLimits(
        uint _idProject,
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _startHour,
        uint _endHour,
        uint _whitelistTimelock
    ) onlyOwner {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        if (_dailyLimit > maxProjectDailyLimit) throw;
        if (_dailyTransactions > maxProjectDailyTransactions) throw;
        if (_transactionLimit > maxProjectTransactionLimit) throw;
        if (_startHour >= 86400) throw;
        if (_endHour > 86400) throw;
        if (_whitelistTimelock < minProjectWhitelistTimelock) throw;

        project.dailyLimit = _dailyLimit;
        project.dailyTransactions = _dailyTransactions;
        project.transactionLimit = _transactionLimit;
        project.startHour = _startHour;
        project.endHour = _endHour;
        project.whitelistTimelock = _whitelistTimelock;

        ProjectLimitsChanged(_idProject);
    }

    /// @notice `onlyOwner` Changes the balance limits to a project's vault,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    function setProjectThresholds(
        uint _idProject,
        uint _topThreshold,
        uint _bottomThreshold
    ) onlyOwner {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        if (_topThreshold > maxProjectTopThreshold) throw;
        if (_bottomThreshold > _topThreshold) throw;

        project.bottomThreshold = _bottomThreshold;
        project.topThreshold = _topThreshold;

        ProjectThresholdsChanged(_idProject);
    }

    /// @notice `onlyOwnerOrProjectAdmin` Changes the Project Admin for a
    ///  specified project's vault
    function setProjectAdmin(
        uint _idProject,
        address _newAdmin
    ) onlyOwnerOrProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        project.admin = _newAdmin;
        ProjectAdminChanged(_idProject);
    }


    /// @notice `onlyOwnerOrProjectAdmin` Requests to Fill up the specified project's vault
    ///  to the topThreshold from th `mainVault`
    function rebalanceProjectHoldings(uint _idProject) onlyOwnerOrProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];
        uint projectBalance = project.vault.getBalance();
        if (projectBalance < project.bottomThreshold) {
            if (checkMainTransfer(address(project.vault), project.topThreshold - projectBalance)) {
                mainVault.authorizePayment(
                  "REFILL PROJECT",
                  bytes32(_idProject),
                  address(project.vault),
                  project.topThreshold - projectBalance,
                  0
                );
                ProjectRefill(_idProject, project.topThreshold - projectBalance);
            }
        }
        if (projectBalance > project.topThreshold) {
            project.vault.authorizePayment(
              "VAULT OVERFLOW",
              bytes32(_idProject),
              address(mainVault),
              projectBalance - project.topThreshold,
              0
            );
            ProjectOverflow(_idProject, projectBalance - project.topThreshold);
        }
    }

    /// @notice `onlyProjectAdmin` Creates a new request to fund a project's vault,
    ///  will fail if any of the parameters are not within the ranges
    ///  predetermined when deploying this contract
    function newPayment(
        uint _idProject,
        string _name,
        bytes32 _reference,
        address _recipient,
        uint _amount
    ) onlyProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        if (project.canceled) throw;

        if (checkProjectTransfer(project, _recipient, _amount)) {

            // We try to do a refill before and after the payment.
            rebalanceProjectHoldings(_idProject);

            uint collectedBefore = project.vault.totalCollected();
            project.vault.authorizePayment(
              _name,
              _reference,
              _recipient,
              _amount,
              0
            );
            uint collectedAfter = project.vault.totalCollected();

            // We expect that the payments are inmediate, so if the payment is
            // pending we just throw
            if (collectedBefore + _amount != collectedAfter ) throw;

            rebalanceProjectHoldings(_idProject);
        } else {
            throw;
        }
    }


    /// @notice `onlyProjectAdmin` Adds `_recipient` to the whitelist of
    ///  possible recipients, but the `_recipient` cannot receive until
    ///  `whitelistTimelock` has passed
    /// @param _idProject the ID# identifying the vault that will fund the `_recipient`
    /// @param _recipient the address to be allowed to receive funds from the specified vault
    /// @param _name Name of the recipient
    function authorizeRecipient(
        uint _idProject,
        address _recipient,
        string _name
    ) onlyProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        Authorization a = project.authorizations[_recipient];
        if ( a.idx > 0) return; // It is already on the whitelist
        a.activationTime = now + project.whitelistTimelock;
        a.idx = ++project.authorizationAddrs.length;
        a.name = _name;
        project.authorizationAddrs[a.idx - 1] = _recipient;
        AuthorizedRecipient(_idProject, _recipient);
    }

    function unauthorizeRecipient(
        uint _idProject,
        address _recipient
    ) onlyProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        Authorization a = project.authorizations[_recipient];
        if (a.idx == 0) return; // It is not authorized no need to remove
        address lastRecipient =
          project.authorizationAddrs[project.authorizationAddrs.length - 1];
        Authorization lastA = project.authorizations[lastRecipient];
        lastA.idx = a.idx;
        project.authorizationAddrs[a.idx-1] = lastRecipient;

        project.authorizationAddrs.length --;

        a.idx = 0;
        a.activationTime = 0;
        a.name = "";

        UnauthorizedRecipient(_idProject, _recipient);
    }

//////
// Check Functions
//////


    function checkMainTransfer(address _dest, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;       //Number of days since Jan 1, 1970 (UTC Timezone) fractional remainder discarded
        uint actualHour = now % actualDay;  //Number of seconds since midnight (UTC Timezone)

        if (actualHour < mainStartHour) actualDay--; // adjusts day to start at `mainStartHour`

        uint timeSinceStart = now - (actualDay * 86400 + mainStartHour);

        uint windowTimeLength = mainEndHour >= mainStartHour ?
                                        mainEndHour - mainStartHour :
                                        86400 + mainEndHour - mainStartHour;

        if (mainDayOfLastTx < actualDay) {
            mainAccTxsInDay = 0;
            mainAccAmountInDay = 0;
            mainDayOfLastTx = actualDay;
        }

        if (mainAccAmountInDay + _amount > mainDailyLimit) return false;
        if (mainAccTxsInDay >= mainDailyTransactions) return false;
        if (_amount > mainTransactionLimit) return false;
        if (timeSinceStart >= windowTimeLength) return false;

        mainAccAmountInDay += _amount;
        mainAccTxsInDay ++;

        return true;
    }


    function checkProjectTransfer(Project storage project, address _dest, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;       //Number of days since Jan 1, 1970 (UTC Timezone) fractional remainder discarded
        uint actualHour = now % actualDay;  //Number of seconds since midnight (UTC Timezone)

        if (actualHour < project.startHour) actualDay--;

        uint timeSinceStart = now - (actualDay * 86400 + project.startHour);

        uint windowTimeLength = project.endHour >= project.startHour ?
                                        project.endHour - project.startHour :
                                        86400 + project.endHour - project.startHour;

        if (project.dayOfLastTx < actualDay) {
            project.accTxsInDay = 0;
            project.accAmountInDay = 0;
            project.dayOfLastTx = actualDay;
        }

        if (project.accAmountInDay + _amount > project.dailyLimit) return false;
        if (project.accTxsInDay >= project.dailyTransactions) return false;
        if (_amount > project.transactionLimit) return false;
        if (timeSinceStart >= windowTimeLength) return false;

        if ((project.authorizations[_dest].activationTime == 0) ||
            (project.authorizations[_dest].activationTime > now))
            return false;

        project.accAmountInDay += _amount;
        project.accTxsInDay ++;

        return true;
    }

/////
// Viewers
/////

    function numberOfProjects() constant returns (uint) {
        return projects.length;
    }

    function getProject(uint _idProject) constant returns (
        string _name,
        address _admin,
        address _vault,
        uint _balance)
    {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        _name = project.name;
        _admin = project.admin;
        _vault = address(project.vault);
        _balance = project.vault.getBalance();
    }

    function getProjectLimits(uint _idProject) constant returns (
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _startHour,
        uint _endHour,
        uint _whitelistTimelock
    ) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        _dailyLimit = project.dailyLimit;
        _dailyTransactions = project.dailyTransactions;
        _transactionLimit = project.transactionLimit;
        _startHour = project.startHour;
        _endHour = project.endHour;
        _whitelistTimelock = project.whitelistTimelock;
    }

    function getProjectNumberOfAuthorizations(uint _idProject) constant
    returns (uint) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        return project.authorizationAddrs.length;
    }

    function getProjectAuthorization(uint _idProject, uint _idx) constant
    returns (
            uint _activationTime,
            string _name
    ) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        if (_idx >= project.authorizationAddrs.length) throw;
        address recipient = project.authorizationAddrs[_idx];

        _activationTime = project.authorizations[recipient].activationTime;
        _name = project.authorizations[recipient].name;
    }

    function isRecipientAuthorized(uint _idProject, address _recipient) constant
    returns (bool) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        if ((project.authorizations[_recipient].activationTime == 0) ||
            (project.authorizations[_recipient].activationTime > now))
            return false;

        return true;
    }


    event AuthorizedRecipient(uint indexed idProject, address indexed recipient);
    event UnauthorizedRecipient(uint indexed idProject, address indexed recipient);
    event Payment(uint indexed idProject, address indexed recipient, bytes32 indexed reference, uint amount);
    event NewProject(uint indexed idProject);
    event ProjectCanceled(uint indexed idProject);
    event ProjectRefill(uint indexed idProject, uint amount);
    event ProjectOverflow(uint indexed idProject, uint amount);

    event ProjectLimitsChanged(uint indexed idProject);
    event ProjectThresholdsChanged(uint indexed idProject);
    event ProjectAdminChanged(uint indexed idProject);
}

contract VaultFactory {
    function createVault(address _baseToken, address _escapeHatchCaller, address _escapeHatchDestination) returns (address) {
        Vault mainVault = new Vault(_baseToken, _escapeHatchCaller, _escapeHatchDestination, 0,0,0,0);
        mainVault.changeOwner(msg.sender);
        return address(mainVault);
    }
}
