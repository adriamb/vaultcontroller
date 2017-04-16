const ethConnector = require("ethconnector");
const assert = require("assert"); // node.js core module
const { sendTx, getBalance, getTransactionReceipt, getBlock } = require("runethtx");

const VaultController = require("../js/vaultcontroller");

describe("Normal Scenario test for VaultController", () => {
    let vaultController;
    let childVaultController;
    let owner;
    let escapeHatchCaller;
    let escapeHatchDestination;
    let spender;
    let recipient;
    let parentVault;
    let admin;
    const web3 = ethConnector.web3;

    let primaryVaultAddr;

    before(async () => {
        const opts = { accounts: [
            { index: 0, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 1, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 2, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 3, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 4, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 5, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 6, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 7, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 8, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
            { index: 9, balance: `0x${ (new web3.BigNumber(web3.toWei(1000))).toString(16) }` },
        ] };
        await ethConnector.init("testrpc", opts);
        owner = ethConnector.accounts[ 0 ];
        escapeHatchCaller = ethConnector.accounts[ 1 ];
        escapeHatchDestination = ethConnector.accounts[ 2 ];
        spender = ethConnector.accounts[ 4 ];
        recipient = ethConnector.accounts[ 5 ];
        parentVault = ethConnector.accounts[ 6 ];
        admin = ethConnector.accounts[ 7 ];
    });
    it("Should deploy all the contracts ", async () => {
        vaultController = await VaultController.deploy(ethConnector.web3, {
            from: owner,
            name: "Main Vault",
            baseToken: 0,
            escapeHatchCaller,
            escapeHatchDestination,
            parentVaultController: 0,
            parentVault,
            dailyAmountLimit: ethConnector.web3.toWei(100),
            dailyTxnLimit: 5,
            txnAmountLimit: ethConnector.web3.toWei(50),
            highestAcceptableBalance: ethConnector.web3.toWei(500),
            lowestAcceptableBalance: ethConnector.web3.toWei(50),
            whiteListTimelock: 86400,
            openingTime: 0,
            closingTime: 86400,
            verbose: false,
        });
        const st = await vaultController.getState();
        primaryVaultAddr = st.primaryVault.address;
        assert.equal(st.owner, owner);
        assert.equal(st.name, "Main Vault");
        assert.equal(st.canceled, false);
        assert.equal(st.escapeHatchCaller, escapeHatchCaller);
        assert.equal(st.escapeHatchDestination, escapeHatchDestination);
        assert.equal(st.baseToken, 0);
        assert.equal(st.parentVault, parentVault);
        assert.equal(st.dailyAmountLimit, ethConnector.web3.toWei(100));
        assert.equal(st.dailyTxnLimit, 5);
        assert.equal(st.txnAmountLimit, ethConnector.web3.toWei(50));
        assert.equal(st.highestAcceptableBalance, ethConnector.web3.toWei(500));
        assert.equal(st.lowestAcceptableBalance, ethConnector.web3.toWei(50));
        assert.equal(st.whiteListTimelock, 86400);
        assert.equal(st.openingTime, 0);
        assert.equal(st.closingTime, 86400);
    }).timeout(20000);
    it("Should send to the primary vault", async () => {
        await sendTx(ethConnector.web3, {
            from: owner,
            to: primaryVaultAddr,
            value: web3.toWei(500),
            gas: 200000,
        });

        const st = await vaultController.getState();
        assert.equal(st.primaryVault.balance, web3.toWei(500));
        const balance = await getBalance(ethConnector.web3, primaryVaultAddr);
        assert.equal(balance, web3.toWei(500));
    }).timeout(6000000);
    it("Should add a child vault", async () => {
        await vaultController.createChildVault({
            from: owner,
            name: "Project 1",
            admin,
            dailyAmountLimit: ethConnector.web3.toWei(100),
            dailyTxnLimit: 5,
            txnAmountLimit: ethConnector.web3.toWei(10),
            highestAcceptableBalance: ethConnector.web3.toWei(20),
            lowestAcceptableBalance: ethConnector.web3.toWei(2),
            whiteListTimelock: 86400,
            openingTime: 0,
            closingTime: 86400,
            verbose: false,
        });
        const st = await vaultController.getState();
        assert.equal(st.childVaults.length, 1);
        assert.equal(st.childVaults[ 0 ].name, "Project 1");
        assert.equal(st.childVaults[ 0 ].owner, admin);
        assert.equal(st.childVaults[ 0 ].canceled, false);
        assert.equal(st.childVaults[ 0 ].escapeHatchCaller, escapeHatchCaller);
        assert.equal(st.childVaults[ 0 ].escapeHatchDestination, escapeHatchDestination);
        assert.equal(st.childVaults[ 0 ].baseToken, 0);
        assert.equal(st.childVaults[ 0 ].parentVault, st.primaryVaultAddr);
        assert.equal(st.childVaults[ 0 ].dailyAmountLimit, ethConnector.web3.toWei(100));
        assert.equal(st.childVaults[ 0 ].dailyTxnLimit, 5);
        assert.equal(st.childVaults[ 0 ].txnAmountLimit, ethConnector.web3.toWei(10));
        assert.equal(st.childVaults[ 0 ].highestAcceptableBalance, ethConnector.web3.toWei(20));
        assert.equal(st.childVaults[ 0 ].lowestAcceptableBalance, ethConnector.web3.toWei(2));
        assert.equal(st.childVaults[ 0 ].whiteListTimelock, 86400);
        assert.equal(st.childVaults[ 0 ].openingTime, 0);
        assert.equal(st.childVaults[ 0 ].closingTime, 86400);

        assert.equal(st.childVaults[ 0 ].primaryVault.balance, web3.toWei(20));
        assert.equal(st.primaryVault.balance, web3.toWei(480));
        childVaultController = new VaultController(web3, st.childVaults[ 0 ].address);
        const stChild = await childVaultController.getState();
        assert.equal(stChild.owner, admin);
    }).timeout(20000);
    it("Should authorize a spender", async () => {
        await vaultController.authorizeSpender({
            name: "Spender 1",
            addr: spender,
            dailyAmountLimit: ethConnector.web3.toWei(100),
            dailyTxnLimit: 5,
            txnAmountLimit: ethConnector.web3.toWei(10),
            openingTime: 0,
            closingTime: 86400,
        });
        const st = await vaultController.getState();
        assert.equal(st.spenders.length, 1);
        assert.equal(st.spenders[ 0 ].name, "Spender 1");
        assert.equal(st.spenders[ 0 ].addr, spender);
        assert.equal(st.spenders[ 0 ].dailyAmountLimit, ethConnector.web3.toWei(100));
        assert.equal(st.spenders[ 0 ].dailyTxnLimit, 5);
        assert.equal(st.spenders[ 0 ].txnAmountLimit, ethConnector.web3.toWei(10));
        assert.equal(st.spenders[ 0 ].openingTime, 0);
        assert.equal(st.spenders[ 0 ].closingTime, 86400);
    }).timeout(10000);
    it("Should authorize a recipient", async () => {
        const txId = await vaultController.authorizeRecipient({
            spender,
            recipient,
            name: "Recipient 1",
        });

        // Calculate the exact time the tx was executed
        const txReceipt = await getTransactionReceipt(web3, txId);
        const block = await getBlock(web3, txReceipt.blockNumber);
        const txTime = block.timestamp;
        const st = await vaultController.getState();
        assert.equal(st.spenders[ 0 ].recipients.length, 1);
        assert.equal(st.spenders[ 0 ].recipients[ 0 ].name, "Recipient 1");
        assert.equal(st.spenders[ 0 ].recipients[ 0 ].addr, recipient);
        assert.equal(st.spenders[ 0 ].recipients[ 0 ].activationTime - txTime, 86400);
    }).timeout(10000);
    it("Should fail if try to send the payment too early", async () => {
        try {
            await vaultController.sendToAuthorizedRecipient({
                from: spender,
                name: "Payment 1",
                reference: web3.sha3("Payment 1"),
                recipient,
                amount: web3.toWei(5),
            });
            throw new Error("PASS");
        } catch (err) {
            assert(err.message !== "PASS");
        }
    }).timeout(10000);
/*    it("Should read test", (done) => {
        vaultController.contract.test5((err, res) => {
            if (err) return done(err);
            console.log("test5: " + res);
            done();
        });
    });
*/
    it("Should wait more than one day", async () => {
        await ethConnector.delay(86501);
    }).timeout(20000000);
    it("Should make the payment", async () => {
        const balanceBefore = await getBalance(web3, recipient);
        await vaultController.sendToAuthorizedRecipient({
            from: spender,
            name: "Payment 1",
            reference: web3.sha3("Payment 1"),
            recipient,
            amount: web3.toWei(4),
            noEstimateGas: true,
        });
        const balanceAfter = await getBalance(web3, recipient);
        assert.equal(balanceAfter.sub(balanceBefore), web3.toWei(4));
        const st = await vaultController.getState();
        assert.equal(st.primaryVault.payments.length, 2);
        assert.equal(st.primaryVault.payments[ 1 ].name, "Payment 1");
        assert.equal(st.primaryVault.payments[ 1 ].reference, web3.sha3("Payment 1"));
        assert.equal(st.primaryVault.payments[ 1 ].amount, web3.toWei(4));
        assert.equal(st.primaryVault.payments[ 1 ].paid, true);
//        console.log(JSON.stringify(st, null, 2));
    }).timeout(10000);
});
