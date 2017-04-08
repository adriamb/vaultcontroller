const Web3 = require("web3");
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const BigNumber = require("bignumber.js");

const eth = web3.eth;
const async = require("async");

const ProjectController = require("./dist/projectcontroller.js");

var gcb = function(err, res) {
    if (err) {
        console.log("ERROR: "+err);
    } else {
        console.log(JSON.stringify(res,null,2));
    }
}

var projectController;

var owner = eth.accounts[0];
var escapeHatchCaller = eth.accounts[1];
var escapeHatchDestination = eth.accounts[2];
var parentVault = eth.accounts[3];

function deployExample(cb) {
    cb = cb || gcb;
    async.series([
        function(cb) {
                ProjectController.deploy(web3, {
                from: owner,
                name: "Main Vault",
                baseToken: 0,
                escapeHatchCaller,
                escapeHatchDestination,
                parentProjectController: 0,
                parentVault,
                maxDailyLimit: web3.toWei(100),
                maxDailyTransactions: 5,
                maxTransactionLimit: web3.toWei(10),
                maxTopThreshold: web3.toWei(500),
                mintWhitelistTimelock: 86400,
                verbose: false,
            }, function(err, _projectController) {
                if (err) return err;
                projectController = _projectController;
                console.log("Project Balancer: " + projectController.contract.address);
                cb();
            });
        },
    ], cb);
}
