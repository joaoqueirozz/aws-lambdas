// SSM
const ssmLib = require('aws-sdk/clients/ssm');
const ssm = new ssmLib();

const utils = require("utils.js");

// Busca conexão do SSM
async function getConfig() {
    return new Promise((resolve, reject) => {
        const promises = [];

        promises.push(utils.getSsmParam(ssm, 'connection_params'));

        Promise.all(promises)
            .then(result => {
                resolve({
                    db_connection: result[0]
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