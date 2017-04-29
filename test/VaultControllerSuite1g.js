/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const filterCoverageTopics = require("./helpers/filterCoverageTopics.js");
const days = require("./helpers/days.js");
const assertJump = require("./helpers/assertJump.js");

const VaultControllerFactory = artifacts.require("../contracts/VaultControllerFactory.sol");
const VaultFactory = artifacts.require("../contracts/VaultFactory.sol");
const VaultController = artifacts.require("../contracts/VaultController.sol");

contract("VaultController:Suite1e:Big Structures", (accounts) => {
    const MAX_GENERATIONS = 10;
    const MAX_CHILDS = 100;
    const GAS_LIMIT = 500000;

    const {
        0: owner,
        1: escapeHatchCaller,
        2: escapeHatchDestination,
    } = accounts;

    let vcf;
    let vf;
    let vc;

    beforeEach(async () => {
        vcf = await VaultControllerFactory.new();
        vf = await VaultFactory.new();
        vc = await VaultController.new(
            "rootvaultcrtl",
            vf.address,
            vcf.address,
            0,
            escapeHatchCaller,
            escapeHatchDestination,
            0,
            0,
        );
    });

    const initializeVault = () => vc.initializeVault(
            10,  // _dailyAmountLimit,
             2,  // _dailyTxnLimit,
             8,  // _txnAmountLimit,
            20,  // _highestAcceptableBalance,
             5,  // _lowestAcceptableBalance,
        days(1), // _whiteListTimelock,
             7,  // _openingTime,
             6,  // _closingTime
        );

    // / -- subvaults --------------------------------------------------

    it(`A maximum of ${ MAX_CHILDS } childs can be generated`, async () => {
        await initializeVault(vc);

        for (let i = 0; i < MAX_CHILDS; i += 1) {
            await vc.createChildVault(`child${ i }`);
        }

        try {
            await vc.createChildVault("child");
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it(`A maximum of ${ MAX_GENERATIONS } generations can be generated`, async () => {
        await initializeVault();

        let vcwalker = vc;

        for (let i = 0; i < MAX_GENERATIONS - 1; i += 1) {
            const result = await vcwalker.createChildVault(`generation${ i }`);
            const logs = filterCoverageTopics(result.logs);
            const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();
            await vcwalker.initializeChildVault(
                vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7,
            );
            const addr = await vcwalker.childVaultControllers(vaultControllerId);
            vcwalker = VaultController.at(addr);
        }
        try {
            await vcwalker.createChildVault("generation");
        } catch (error) {
            return assertJump(error);
        }
        assert.fail("should have thrown before");
    });

    it("Cancelling a big structure should be allowed in multiple steps", async () => {
        await initializeVault();

        const createChilds = async (base, depth, childs) => {
            if (depth === 0) return;

            for (let i = 0; i < childs; i += 1) {
                const result = await base.createChildVault("child");
                const logs = filterCoverageTopics(result.logs);
                const vaultControllerId = logs[ 0 ].args.vaultControllerId.toNumber();

                await base.initializeChildVault(
                    vaultControllerId, owner, 10, 2, 8, 20, 5, days(1), 6, 7,
                );

                const addr = await base.childVaultControllers(vaultControllerId);
                const childController = VaultController.at(addr);
                await createChilds(childController, depth - 1, childs);
            }
        };

        const checkCanceledChilds = async (base) => {
            const childs = (await base.numberOfChildVaults()).toNumber();

            for (let i = 0; i < childs; i += 1) {
                const addr = await base.childVaultControllers(i);
                const childController = VaultController.at(addr);
                assert.equal(true, await childController.canceled());

                await checkCanceledChilds(childController);
            }
        };

        let cancelCount = 0;
        await createChilds(vc, 3, 3);
        let canceled = await vc.canceled();
        while (!canceled) {
            cancelCount += 1;
            await vc.cancelVault({ gas: 2 * GAS_LIMIT });
            canceled = await vc.canceled();
        }
        assert.equal(true, cancelCount > 0);
        await checkCanceledChilds(vc);
    });
});
