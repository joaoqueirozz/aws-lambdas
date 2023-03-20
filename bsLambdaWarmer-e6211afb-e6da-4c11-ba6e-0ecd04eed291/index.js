const utils = require('utils');
const config = require('./functions.json');
const lambdaLib = require('aws-sdk/clients/lambda');
const lambda = new lambdaLib();

function warmupLambdas(lambdas, env) {
    return new Promise((resolve, reject) => {
        const promises = [];
        const params = {
            warmer: true
        }

        for (let i = 0; i < lambdas.length; i++) {
            const lambdaName = `${lambdas[i]}:${env}`;
            console.log(`WARMUP> ${lambdaName}`);
            promises.push(utils.invokeLambda(lambda, lambdaName, params));
        }

        Promise.all(promises)
            .then(() => {
                resolve();
            })
            .catch(err => {
                reject(err);
            })
    });
}


exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    try {
        await warmupLambdas(config.lambdas, config.env);
        return {
            message: 'Todos os lambdas aquecidos com sucesso!'
        }
    } catch (err) {
        utils.handleError(err);
    }
};