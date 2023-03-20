// Lambda
const lambdaLib = require("aws-sdk/clients/lambda");
const lambda = new lambdaLib();

const utils = require("utils.js");

// Busca conexão do SSM
async function lambdaImportData(env, resourceType, params, payload, methodType) {
    const response = await utils.invokeLambda(lambda, `msImportDataMV:${env}`, {
        resourceType,
        payload,
        params,
        env,
        methodType,
    });

    if (response.status === 200 && response.entidadeId) {
        console.log(`>>> Realizada gravação na MV id:${JSON.stringify(response.entidadeId)} <<<`);
        return response;
    } else throw utils.buildCustomError(400, response);
}

// Envia mensagem de erro para o Slack
async function lambdaSlackChatBot(env, resourceType, id, modified, err) {
    if (env === "prd") {
        await utils.invokeLambda(lambda, `msSlackChatBot`, {
            lambda: "msCreateMVData",
            resourceType,
            id,
            modified,
            err,
        });
    }
}

// Envia os dados para a base Oracle
async function lambdaAccessOracle(param, queryData) {
    return await utils.invokeLambda(lambda, `msAccessOracleMV`, {
        user: param.user,
        password: param.password,
        connectString: param.connectString,
        formatObject: true,
        queryData,
    });
}

module.exports = {
    lambdaImportData,
    lambdaSlackChatBot,
    lambdaAccessOracle
}