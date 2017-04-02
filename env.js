const Web3 = require("web3");
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const BigNumber = require("bignumber.js");

const eth = web3.eth;
const async = require("async");

const ProjectBalancer = require("./dist/projectbalancer.js");

var gcb = function(err, res) {
    if (err) {
        console.log("ERROR: "+err);
    } else {
        console.log(JSON.stringify(res,null,2));
    }
}

var projectBalancer;

var owner = eth.accounts[0];
var escapeHatchCaller = eth.accounts[1];
var escapeHatchDestination = eth.accounts[2];

function deployExample(cb) {
    cb = cb || gcb;
    async.series([
        function(cb) {
            ProjectBalancer.deploy(web3, {
                from: owner,
                baseToken: 0,
                escapeHatchCaller,
                escapeHatchDestination,
                mainDailyLimit: web3.toWei(100),
                mainDailyTransactions: 5,
                mainTransactionLimit: web3.toWei(10),
                mainStartHour: 0,
                mainEndHour: 86400,
                mainVaultBottomThreshold: web3.toWei(300),
                mainVaultTopThreshold: web3.toWei(500),
                maxProjectDailyLimit: web3.toWei(10),
                maxProjectDailyTransactions: web3.toWei(10),
                maxProjectTransactionLimit: 5,
                maxProjectTopThreshold: web3.toWei(10),
                minProjectWhitelistTimelock: 86400,
                verbose: true,
            }, function(err, _projectBalancer) {
                if (err) return err;
                projectBalancer = _projectBalancer;
                console.log("Project Balancer: " + projectBalancer.contract.address);
                cb();
            });
        },
    ], cb);
}
