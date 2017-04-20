const ethConnector = require("ethconnector");
const assert = require("assert"); // node.js core module
const { sendTx, getBalance, getTransactionReceipt, getBlock } = require("runethtx");

const VaultController = require("../js/vaultcontroller");

describe("Create a full structure of Vaults and cancel at once", () => {
    const vaultControllers = [];
    let childVaultController;
    let owner;
    let escapeHatchCaller;
    let escapeHatchDestination;
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
        parentVault = ethConnector.accounts[ 6 ];
        admin = ethConnector.accounts[ 7 ];
    });
    it("Should deploy all the contracts ", async () => {
        vaultControllers[ 0 ] = [];
        vaultControllers[ 0 ][ 0 ] = await VaultController.deploy(web3, {
            from: owner,
            name: "Vault 0 0",
            baseToken: 0,
            escapeHatchCaller,
            escapeHatchDestination,
            parentVaultController: 0,
            parentVault,
            dailyAmountLimit: web3.toWei(600),
            dailyTxnLimit: 50,
            txnAmountLimit: web3.toWei(300),
            highestAcceptableBalance: web3.toWei(600),
            lowestAcceptableBalance: web3.toWei(50),
            whiteListTimelock: 86400,
            openingTime: 0,
            closingTime: 86400,
            verbose: false,
        });
        const st = await vaultControllers[ 0 ][ 0 ].getState();
        primaryVaultAddr = st.primaryVault.address;
        assert.equal(st.owner, owner);
        assert.equal(st.name, "Vault 0 0");
        assert.equal(st.canceled, false);
        assert.equal(st.escapeHatchCaller, escapeHatchCaller);
        assert.equal(st.escapeHatchDestination, escapeHatchDestination);
        assert.equal(st.baseToken, 0);
        assert.equal(st.parentVault, parentVault);
        assert.equal(st.dailyAmountLimit, ethConnector.web3.toWei(600));
        assert.equal(st.dailyTxnLimit, 50);
        assert.equal(st.txnAmountLimit, ethConnector.web3.toWei(300));
        assert.equal(st.highestAcceptableBalance, ethConnector.web3.toWei(600));
        assert.equal(st.lowestAcceptableBalance, ethConnector.web3.toWei(50));
        assert.equal(st.whiteListTimelock, 86400);
        assert.equal(st.openingTime, 0);
        assert.equal(st.closingTime, 86400);
    }).timeout(20000);
    it("Should send to the primary vault", async () => {
        await sendTx(ethConnector.web3, {
            from: owner,
            to: primaryVaultAddr,
            value: web3.toWei(600),
            gas: 200000,
        });

        const st = await vaultControllers[ 0 ][ 0 ].getState();
        assert.equal(st.primaryVault.balance, web3.toWei(600));
        const balance = await getBalance(ethConnector.web3, primaryVaultAddr);
        assert.equal(balance, web3.toWei(600));
    }).timeout(6000000);
    it("Should add a childs vault structure", async () => {
        for (let i = 1; i <= 9; i += 1) {
            vaultControllers[ i ] = [];
            for (let j = 0; j < 2; j += 1) {
//                console.log("Child "+i+"  "+j);
                vaultControllers[ i ][ j ] = await vaultControllers[ i - 1 ][ 0 ].createChildVault({
                    from: owner,
                    name: `Project ${ i } ${ j }`,
                    admin: owner,
                    dailyAmountLimit: web3.toWei(512 >> i),
                    dailyTxnLimit: 5,
                    txnAmountLimit: web3.toWei(512 >> i),
                    highestAcceptableBalance: web3.toWei(512 >> i),
                    lowestAcceptableBalance: web3.toWei(0.1),
                    whiteListTimelock: 86400,
                    openingTime: 0,
                    closingTime: 86400,
                    verbose: false,
                });
            }
        }
        const st = await vaultControllers[ 0 ][ 0 ].getState();
//        console.log(JSON.stringify(st,null,2));
        assert.equal(st.primaryVault.balance, web3.toWei(600 - 512));
        assert.equal(st.childVaults[ 0 ].primaryVault.balance, web3.toWei(0));
        assert.equal(st.childVaults[ 1 ].primaryVault.balance, web3.toWei(256));
    }).timeout(60000);
    it("Should cancel the whole structure", async () => {
        const balanceBefore = await getBalance(web3, parentVault);
        await vaultControllers[ 0 ][ 0 ].cancelVault({
            from: owner,
        });
        const balanceAfter = await getBalance(web3, parentVault);
        assert.equal(balanceAfter.sub(balanceBefore), web3.toWei(600));
    }).timeout(60000000);
});
