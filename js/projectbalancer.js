import async from "async";
import _ from "lodash";
import { deploy, sendContractTx, asyncfunc } from "runethtx";
import { ProjectBalancerAbi, ProjectBalancerByteCode, VaultFactoryAbi, VaultFactoryByteCode } from "../contracts/ProjectBalancer.sol.js";

export default class ProjectBalancer {

    constructor(web3, address) {
        this.web3 = web3;
        this.contract = this.web3.eth.contract(ProjectBalancerAbi).at(address);
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
            let projectBalancer;
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
                    params.abi = ProjectBalancerAbi;
                    params.byteCode = ProjectBalancerByteCode;
                    deploy(web3, params, (err, _projectBalancer) => {
                        if (err) {
                            cb1(err);
                            return;
                        }
                        projectBalancer = new ProjectBalancer(web3, _projectBalancer.address);
                        cb1();
                    });
                },
                (cb1) => {
                    projectBalancer.initialize({}, cb1);
                },
            ],
            (err) => {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, projectBalancer);
            });
        }, _cb);
    }
}
