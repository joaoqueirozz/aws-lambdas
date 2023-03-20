// layers
const utils = require('utils.js');
global.fetch = require("node-fetch");

async function importDataMV(resourceType, data, params, env, methodType) {

    const method = methodType === 'create' ? 'PUT' : 'POST';
    const resourceMethod = methodType === 'create' ? 'insere' : 'atualiza';

    return new Promise((resolve, reject) => {
        fetch(`${params[`address_${env}`]}/mvservices/${params.resource[resourceType]}/${resourceMethod}`,
            {
                method,
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json",
                },
            }
        ).then(response => response.json())
            .then(result => resolve(result))
            .catch((err) => { reject(err) });
    })
}

exports.handler = async (event, context) => {
    try {

        const resourceType = utils.assertRequiredValue('resourceType', event.resourceType, 'string');
        const payload = utils.assertRequiredValue('payload', event.payload, 'object');
        const params = utils.assertRequiredValue('params', event.params, 'object');
        const env = utils.assertRequiredValue('env', event.env, 'string');
        const methodType = utils.assertRequiredValue('env', event.methodType, 'string');

        // Importa os dados no ambiente da MV
        return await importDataMV(resourceType, payload, params, env, methodType);

    } catch (err) {
        utils.handleError(err);
    }
};