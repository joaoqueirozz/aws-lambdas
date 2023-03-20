const utils = require('utils.js');
const fhirOmopConverter = require('fhir-omop-converter');
const findPatient = require('./findPatient');
const insertPractice = require('./insertPractice');

const ssmLib = require('aws-sdk/clients/ssm');
const ssm = new ssmLib();

let env;

async function getConfig() {
    return new Promise((resolve, reject) => {
        const promises = [];

        promises.push(utils.getSsmParam(ssm, 'connection_params'));

        Promise.all(promises)
            .then(result => {
                resolve({
                    connection_params: result[0]
                });
            })
            .catch(err => {
                reject(err);
            });
    });
}

function extractQuertStringParams(url) {
    const qs = utils.assertRequiredValue('Patient querystring', url.split('?')[1], 'string');
    const params = qs.split('&');
    const qsParams = {};

    for (let i = 0; i < params.length; i++) {
        const keyVal = params[i].split('=');
        qsParams[keyVal[0]] = keyVal[1];
    }

    return qsParams;
}

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    if (event.warmer) {
        console.log('LAMBDA WARMER> warmup successful');
        return 0;
    }

    try {
        if (!event.Records || event.Records.length === 0) {
            return {
                message: 'Nothing to process'
            };
        }

        for (let k = 0; k < event.Records.length; k++) {
            // verifica mensagem
            const body = utils.assertRequiredValue('body', JSON.parse(event.Records[k].body), 'object');
            const modified = utils.assertRequiredValue('modified', body.modified, 'string');
            const messageEvent = utils.assertRequiredValue('event', body.event, 'object');
            const payload = utils.assertRequiredValue('payload', messageEvent.payload, 'object');
            const base_url = utils.assertRequiredValue('base_url', messageEvent.base_url, 'string');
            const resourceType = utils.assertRequiredValue('resourceType', payload.resourceType, 'string');
            const entry = utils.assertRequiredValue('entry', payload.entry, 'object');
            const db_schema = utils.assertRequiredValue('db_schema', messageEvent.db_schema, 'string');
            const dw_schema = utils.assertRequiredValue('dw_schema', messageEvent.dw_schema, 'string');

            // atribui environment
            env = messageEvent.env;

            // obtém configurações
            const {
                connection_params
            } = await getConfig();

            if (entry.length !== 2) {
                throw utils.buildCustomError(400, 'Payload inválido');
            }

            const transaction = {};

            for (let i = 0; i < entry.length; i++) {
                const request = utils.assertRequiredValue(`entry[${i}].request`, entry[i].request, 'object');
                const method = utils.assertRequiredValue(`entry[${i}].request.method`, request.method, 'string');
                const url = utils.assertRequiredValue(`entry[${i}].request.url`, request.url, 'string');

                switch (method) {
                    case 'GET': {
                        const qsParams = extractQuertStringParams(url);

                        transaction['GET'] = {
                            env,
                            resourceType: 'Patient',
                            history: false,
                            connection_params,
                            dw_schema,
                            base_url,
                            identifier: qsParams['identifier']
                        };

                        break;
                    }
                    case 'POST': {
                        const payload = utils.assertRequiredValue(`entry[${i}].resource`, entry[i].resource, 'object');

                        transaction['POST'] = {
                            env,
                            resourceType: 'Appointment',
                            payload
                        };

                        break;
                    }
                }
            }

            const associate = await findPatient.run(transaction['GET']);
            const omop = await fhirOmopConverter.fhirToOmop(env, transaction['POST'].payload, transaction['POST'].resourceType);
            const paracticeData = omop.main.data;

            if (!paracticeData) {
                throw utils.buildCustomError(500, 'Erro inesperado: [main.data is NULL]');
            }

            // adiciona valores obtidos da primeira busca (DW)
            paracticeData.beneficiary_id = associate.beneficiary_id;
            paracticeData.company_id = associate.company_id;

            await insertPractice.run({
                env,
                resourceType: 'Appointment',
                history: false,
                connection_params,
                db_schema,
                base_url,
                data: paracticeData
            });
        }

        return {
            status: 'success',
            message: 'Atividade(s) Gympass gravada(s) com sucesso.'
        }
    } catch (err) {
        utils.handleError(err);
    }
};