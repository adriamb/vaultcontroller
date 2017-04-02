pragma solidity ^0.4.6;

import "../node_modules/vaultcontract/contracts/Vault.sol";

contract ProjectBalancer is Owned {

    struct Authorization {
        uint idx;  // address in  the array relative to 1
        uint activationTime;
    }

    struct Project {
        string name;
        address admin;
        Vault vault;

        uint dailyLimit;
        uint dailyTransactions;
        uint transactionLimit;
        uint startHour;
        uint endHour;
        uint bottomThreshold;
        uint topThreshold;
        uint whitelistTimelock;
        mapping (address => Authorization) authorizations;
        address[] authorizationAddrs;

        bool canceled;

        uint accTxsInDay;
        uint accAmountInDay;
        uint dayOfLastTx;
    }

    Project[] projects;

    Vault public mainVault;

    VaultFactory vaultFactory;
    address baseToken;
    address escapeHatchCaller;
    address escapeHatchDestination;
    uint mainDailyLimit;
    uint mainDailyTransactions;
    uint mainTransactionLimit;
    uint mainStartHour;
    uint mainEndHour;
    uint mainVaultBottomThreshold;
    uint mainVaultTopThreshold;
    uint maxProjectDailyLimit;
    uint maxProjectDailyTransactions;
    uint maxProjectTransactionLimit;
    uint maxProjectStartHour;
    uint maxProjectEndHour;
    uint maxProjectTopThreshold;
    uint minProjectWhitelistTimelock;

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
        vaultFactory = VaultFactory(_vaultFactory);
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

    function initialize() onlyOwner {

        if (address(mainVault) != 0) throw;

        mainVault = Vault(vaultFactory.createVault(baseToken, escapeHatchCaller, escapeHatchDestination));

        mainVault.authorizeSpender(
            address(this),
            "Project Balancer",
            0x0,
            0x0,
            new bytes(0)
        );
    }

    modifier onlyOwnerOrProjectAdmin(uint idProject) {
        if (    (idProject < projects.length)
             || (    (projects[idProject].admin != msg.sender)
                  && (owner != msg.sender)))
           throw;
        _;
    }

    modifier onlyProjectAdmin(uint idProject) {
        if (   (idProject < projects.length)
            || (projects[idProject].admin != msg.sender))
           throw;
        _;
    }

    function createProject(
        string _name,
        address _admin,
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _startHour,      // 0-86399   (Secons since start of the UTC day)
        uint _endHour,
        uint _topThreshold,
        uint _bottomThreshold,
        uint _whiteListTimelock
    ) onlyOwner returns (uint) {
        uint idProject = projects.length++;
        Project project = projects[idProject];

        if (_dailyLimit > maxProjectDailyLimit) throw;
        if (_dailyTransactions > maxProjectDailyTransactions) throw;
        if (_transactionLimit > maxProjectTransactionLimit) throw;
        if (_startHour >= 86400) throw;
        if (_endHour > 86400) throw;
        if (_whiteListTimelock < minProjectWhitelistTimelock) throw;

        if (_topThreshold > maxProjectTopThreshold) throw;
        if (_bottomThreshold > _topThreshold) throw;

        project.name = _name;
        project.admin = _admin;
        project.vault = Vault( vaultFactory.createVault(baseToken, escapeHatchCaller, escapeHatchDestination));
        project.vault.authorizeSpender(
            address(this),
            "Project Balancer",
            0x0,
            0x0,
            new bytes(0)
        );
        project.dailyLimit = _dailyLimit;
        project.dailyTransactions = _dailyTransactions;
        project.transactionLimit = _transactionLimit;
        project.startHour = _startHour;
        project.endHour = _endHour;
        project.whitelistTimelock = _whiteListTimelock;
        project.bottomThreshold = _bottomThreshold;
        project.topThreshold = _topThreshold;

        NewProject(idProject);

        // Do the initial transfer

        refillProject(idProject);
        return idProject;
    }

    function cancelProject(uint _idProject) onlyOwner {

        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        uint projectBalance = project.vault.getBalance();

        if ((projectBalance > 0) || (!project.canceled)) {
            project.vault.authorizePayment(
              "CANCEL PROJECT",
              bytes32(_idProject),
              address(mainVault),
              project.vault.getBalance(),
              0
            );
            project.canceled = true;
            project.topThreshold = 0;
            project.bottomThreshold = 0;
            ProjectCancel(_idProject);
        }
    }

    function cancelAll() onlyOwner {
        uint i;
        for (i=0; i<projects.length; i++) {
            cancelProject(i);
        }
    }



    function setProjectLimits(
        uint _idProject,
        uint _dailyLimit,
        uint _dailyTransactions,
        uint _transactionLimit,
        uint _startHour,
        uint _endHour,
        uint _whiteListTimelock
    ) onlyOwner {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        if (_dailyLimit > maxProjectDailyLimit) throw;
        if (_dailyTransactions > maxProjectDailyTransactions) throw;
        if (_transactionLimit > maxProjectTransactionLimit) throw;
        if (_startHour >= 86400) throw;
        if (_endHour > 86400) throw;
        if (_whiteListTimelock < minProjectWhitelistTimelock) throw;

        project.dailyLimit = _dailyLimit;
        project.dailyTransactions = _dailyTransactions;
        project.transactionLimit = _transactionLimit;
        project.startHour = _startHour;
        project.endHour = _endHour;
        project.whitelistTimelock = _whiteListTimelock;

        ProjectLimitsChanged(_idProject);
    }

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

        ProjectThresholsChanged(_idProject);
    }

    function setProjectAdmin(
        uint _idProject,
        address _newAdmin
    ) onlyOwnerOrProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        project.admin = _newAdmin;
        ProjectAdminhanged(_idProject);
    }


    function refillProject(uint _idProject) onlyOwnerOrProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];
        uint projectBalance = project.vault.getBalance();
        if (projectBalance >= project.bottomThreshold) return;
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
        }
    }

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
            refillProject(_idProject);

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

            refillProject(_idProject);
        } else {
            throw;
        }
    }



    function authorizeRecipient(
        uint _idProject,
        address _recipient,
        bool _authorize
    ) onlyProjectAdmin(_idProject) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        Authorization a = project.authorizations[_recipient];
        if (_authorize) {
            if ( a.idx > 0) return; // It is already authorizedRecipients
            a.activationTime = now + project.whitelistTimelock;
            a.idx = ++project.authorizationAddrs.length;
            project.authorizationAddrs[a.idx - 1] = _recipient;
        } else {
            if (a.idx == 0) return; // It is not authorized
            address lastRecipient =
              project.authorizationAddrs[project.authorizationAddrs.length - 1];
            Authorization lastA = project.authorizations[lastRecipient];

            lastA.idx = a.idx;
            project.authorizationAddrs[a.idx-1] = lastRecipient;

            project.authorizationAddrs.length --;

            a.idx = 0;
            a.activationTime = 0;
        }
    }

//////
// Check Functions
//////

    uint mainAccTxsInDay;
    uint mainAccAmountInDay;
    uint mainDayOfLastTx;

    function checkMainTransfer(address _dest, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;
        uint actualHour = now % actualDay;

        if (actualHour < mainStartHour) actualDay--;

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
        if (mainAccTxsInDay >= mainAccTxsInDay) return false;
        if (_amount > mainTransactionLimit) return false;
        if (timeSinceStart >= windowTimeLength) return false;

        mainAccAmountInDay += _amount;
        mainAccTxsInDay ++;

        return true;
    }


    function checkProjectTransfer(Project storage project, address _dest, uint _amount) internal returns (bool) {
        uint actualDay = now / 86400;
        uint actualHour = now % actualDay;

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
        if (project.accTxsInDay >= project.accTxsInDay) return false;
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

    function getProject(uint _idProject) returns (string _name, address _admin, address _vault, uint _balance) {
        if (_idProject >= projects.length) throw;
        Project project = projects[_idProject];

        _name = project.name;
        _admin = project.admin;
        _vault = address(project.vault);
        _balance = project.vault.getBalance();
    }

    event AuthorizedRecipient(uint indexed idProject, address indexed recipient, bool authorided);
    event Payment(uint indexed idProject, address indexed recipient, bytes32 indexed reference, uint amount);
    event NewProject(uint indexed idProject);
    event ProjectCancel(uint indexed idProject);
    event ProjectRefill(uint indexed idProject, uint amount);

    event ProjectLimitsChanged(uint indexed idProject);
    event ProjectThresholsChanged(uint indexed idProject);
    event ProjectAdminhanged(uint indexed idProject);
}

contract VaultFactory {
    function createVault(address _baseToken, address _escapeHatchCaller, address _escapeHatchDestination) returns (address) {
        Vault mainVault = new Vault(_baseToken, _escapeHatchCaller, _escapeHatchDestination, 0,0,0,0);
        mainVault.changeOwner(msg.sender);
        return address(mainVault);
    }
}
