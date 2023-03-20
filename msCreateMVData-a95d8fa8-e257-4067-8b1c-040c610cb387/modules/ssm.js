// SSM
const ssmLib = require('aws-sdk/clients/ssm');
const ssm = new ssmLib();

const utils = require("utils.js");

// Busca conexão do SSM
async function getConfig() {
    return new Promise((resolve, reject) => {
        const promises = [];

        promises.push(utils.getSsmParam(ssm, 'connection_params'));
        promises.push(utils.getSsmParam(ssm, 'mv_integration_config'));
        promises.push(utils.getSsmParam(ssm, 'connection_params_mv'));

        Promise.all(promises)
            .then(result => {
                resolve({
                    connection: result[0],
                    integration: result[1],
                    connection_mv: result[2],
                });
            })
            .catch(err => {
                reject(err);
            });
    });
}

module.exports = {
    getConfig
}