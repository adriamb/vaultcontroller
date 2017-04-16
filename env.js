var Web3 = require("web3");
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BigNumber = require("bignumber.js");

var eth = web3.eth;
var async = require("async");

var VaultController = require("./js/vaultcontroller.js");

var gcb = (err, res) => {
    if (err) {
        console.log("ERROR: "+err);
    } else {
        console.log(JSON.stringify(res,null,2));
    }
};

var vaultController;

var owner = eth.accounts[ 0 ];
var escapeHatchCaller = eth.accounts[ 1 ];
var escapeHatchDestination = eth.accounts[ 2 ];
var parentVault = eth.accounts[ 3 ];
var admin = eth.accounts[ 4 ];

var deployExample = (_cb) => {
    const cb = _cb || gcb;
    async.series([
        (cb2) => {
            VaultController.deploy(web3, {
                from: owner,
                name: "Main Vault",
                baseToken: 0,
                escapeHatchCaller,
                escapeHatchDestination,
                parentVaultController: 0,
                parentVault,
                dailyAmountLimit: web3.toWei(100),
                dailyTxnLimit: 5,
                txnAmountLimit: web3.toWei(50),
                highestAcceptableBalance: web3.toWei(500),
                lowestAcceptableBalance: web3.toWei(50),
                whiteListTimelock: 86400,
                openingTime: 0,
                closingTime: 86400,
                verbose: false,
            }, (err, _vaultController) => {
                if (err) return err;
                vaultController = _vaultController;
                console.log("Vault Controller: " + vaultController.contract.address);
                cb2();
            });
        },
    ], cb);
};

var addChildVault = (_cb) => {
    const cb = _cb || gcb;
    vaultController.createChildVault({
        from: owner,
        name: "Project 1",
        admin,
        dailyAmountLimit: web3.toWei(100),
        dailyTxnLimit: 5,
        txnAmountLimit: web3.toWei(10),
        highestAcceptableBalance: web3.toWei(20),
        lowestAcceptableBalance: web3.toWei(2),
        whiteListTimelock: 86400,
        openingTime: 0,
        closingTime: 86400,
        verbose: false,
    }, cb);
};

var getState = (_cb) => {
    const cb = _cb || gcb;
    vaultController.getState(cb);
};
