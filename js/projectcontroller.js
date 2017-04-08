import async from "async";
import _ from "lodash";
import { deploy, sendContractTx, asyncfunc } from "runethtx";
import { ProjectControllerAbi, ProjectControllerByteCode, ProjectControllerFactoryAbi, ProjectControllerFactoryByteCode, VaultFactoryAbi, VaultFactoryByteCode } from "../contracts/ProjectController.sol.js";

export default class ProjectController {

    constructor(web3, address) {
        this.web3 = web3;
        this.contract = this.web3.eth.contract(ProjectControllerAbi).at(address);
    }

    getState(_cb) {
        return asyncfunc((cb) => {
            const st = {};
            let nProjects;
            async.series([
                (cb1) => {
                    this.contract.owner((err, _owner) => {
                        if (err) { cb(err); return; }
                        st.owner = _owner;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.mainVault((err, _mainVault) => {
                        if (err) { cb(err); return; }
                        st.mainVault = _mainVault;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.numberOfProjects((err, res) => {
                        if (err) { cb(err); return; }
                        nProjects = res.toNumber();
                        st.projects = [];
                        cb1();
                    });
                },
                (cb1) => {
                    async.eachSeries(_.range(0, nProjects), (idProject, cb2) => {
                        this.contract.getProject(idProject, (err, res) => {
                            if (err) { cb(err); return; }
                            st.projects.push({
                                idProject,
                                name: res[ 0 ],
                                admin: res[ 1 ],
                                vault: res[ 2 ],
                                balance: res[ 3 ],
                            });
                            cb2();
                        });
                    }, cb1);
                },
            ], (err) => {
                if (err) { cb(err); return; }
                cb(null, st);
            });
        }, _cb);
    }

    createProject(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "createProject",
            opts,
            cb);
    }

    initialize(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "initialize",
            Object.assign({}, opts, {
                extraGas: 250000,
            }),
            cb);
    }

    static deploy(web3, opts, _cb) {
        return asyncfunc((cb) => {
            let projectController;
            const params = Object.assign({}, opts);
            async.series([
                (cb1) => {
                    params.abi = VaultFactoryAbi;
                    params.byteCode = VaultFactoryByteCode;
                    deploy(web3, params, (err, _vaultFactory) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        params.vaultFactory = _vaultFactory.address;
                        cb1();
                    });
                },
                (cb1) => {
                    params.abi = ProjectControllerFactoryAbi;
                    params.byteCode = ProjectControllerFactoryByteCode;
                    deploy(web3, params, (err, _projectControllerFactory) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        params.projectControllerFactory = _projectControllerFactory.address;
                        cb1();
                    });
                },
                (cb1) => {
                    params.abi = ProjectControllerAbi;
                    params.byteCode = ProjectControllerByteCode;
                    deploy(web3, params, (err, _projectController) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        projectController = new ProjectController(web3, _projectController.address);
                        cb1();
                    });
                },
                (cb1) => {
                    projectController.initialize({}, cb1);
                },
            ],
            (err) => {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, projectController);
            });
        }, _cb);
    }
}
