const Web3 = require("web3");
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const BigNumber = require("bignumber.js");

const eth = web3.eth;
const async = require("async");

const ProjectController = require("./js/vaultcontroller.js");

const gcb = (err, res) => {
    if (err) {
        console.log("ERROR: "+err);
    } else {
        console.log(JSON.stringify(res,null,2));
    }
};

let projectController;

const owner = eth.accounts[ 0 ];
const escapeHatchCaller = eth.accounts[ 1 ];
const escapeHatchDestination = eth.accounts[ 2 ];
const parentVault = eth.accounts[ 3 ];

const deployExample = (_cb) => {
    const cb = _cb || gcb;
    async.series([
        (cb2) => {
            ProjectController.deploy(web3, {
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
            }, (err, _projectController) => {
                if (err) return err;
                projectController = _projectController;
                console.log("Project Balancer: " + projectController.contract.address);
                cb2();
            });
        },
    ], cb);
};
