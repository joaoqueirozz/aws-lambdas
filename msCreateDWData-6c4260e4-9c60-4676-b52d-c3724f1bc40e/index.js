// layers
const utils = require("utils.js");
const mapper = require('dataMapping');
const models = require('models');

// modules
const dynamoDB = require('./modules/dynamodb');
const rds = require('./modules/rds');
const enums = require('./map/enumerators');

// SSM
const ssmLib = require('aws-sdk/clients/ssm');
const ssm = new ssmLib();

// Busca conexão do SSM
async function getConfig() {
    return new Promise((resolve, reject) => {
        const promises = [];

        promises.push(utils.getSsmParam(ssm, 'connection_params'));
        promises.push(utils.getSsmParam(ssm, 'tablenames'));

        Promise.all(promises)
            .then(result => {
                resolve({
                    connection: result[0],
                    tablenames: result[1],
                });
            })
            .catch(err => {
                reject(err);
            });
    });
}

// Busca valor da chave primária externa
function getFieldExternalId(resourceType, payload, type) {

    const propTypesPrimary = {
        HealthcareService: 'CD_PRESTADOR_ENDERECO',
        InsurancePlan: 'CD_PLANO',
        GroupSite: 'CD_PRESTADOR_ENDERECO'
    };

    const propTypesSecundary = {
        GroupSite: 'CD_PLANO'
    };

    return type === 'primary' ? payload[propTypesPrimary[resourceType]] : payload[propTypesSecundary[resourceType]];
}

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    try {
        if (!event.Records || event.Records.length === 0) {
            return {
                message: 'Nothing to process'
            };
        }

        console.log(JSON.stringify(event));

        const { connection, tablenames } = await getConfig();

        for (let i = 0; i < event.Records.length; i++) {
            const body = utils.assertRequiredValue('body', JSON.parse(event.Records[i].body), 'object');
            const resourceType = utils.assertRequiredValue('resourceType', body.resourceType, 'string');
            const payload = utils.assertRequiredValue('payload', body.data, 'object');
            env = utils.assertRequiredValue('env', body.env, 'string');

            const schema = env === 'prd' ? 'datawarehouse' : `datawarehouse_${env}`;

            console.log(`>>> ${JSON.stringify(env)} <<<`);
            console.log(`>>> ${JSON.stringify(resourceType)} <<<`);
            console.log(`>>> ${JSON.stringify(payload)} <<<`);

            // Busca o valor da chave primária externa;
            const primaryId = getFieldExternalId(resourceType, payload, 'primary');
            const secundaryId = getFieldExternalId(resourceType, payload, 'secundary');

            // Verifica se o atendimento existe na tabela de controle
            const controlItem = await dynamoDB.getControl(resourceType, env, primaryId, secundaryId);

            // Se o registros já existe passa para a próxima iteração.
            if (controlItem) continue;

            // Converte dados para importação no DW
            const data = await mapper.convertDataMapping(env, null, 'Mv', tablenames[resourceType.toLowerCase()], payload, enums, 'Import', 'create');
            console.log(`>>> ${JSON.stringify(data)} <<<`);

            // conecta no DW
            await rds.connect(connection);

            await rds.create(schema, resourceType, tablenames[resourceType.toLowerCase()], data, primaryId, secundaryId, env);
            console.log('>>> Realizada gravação no DW <<<');

            // desconecta do DW
            rds.disconnect();
        }

        return {
            message: "Gravação realizada com sucesso"
        };
    } catch (err) {
        utils.handleError(err);
    } finally {
        rds.disconnect();
    }
};