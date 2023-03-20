const utils = require('utils.js');
const fhirOmopConverter = require('fhir-omop-converter');
const knex = require('knex');
const models = require('models');
const {
    v4: uuidv4
} = require('uuid');

const ssmLib = require('aws-sdk/clients/ssm');
const ssm = new ssmLib();
const awsSQS = require('aws-sdk/clients/sqs');
const sqs = new awsSQS();

let client;
let env;

function getClient(connection) {
    return knex({
        client: 'pg',
        connection
    });
}

async function getConfig() {
    return new Promise((resolve, reject) => {
        const promises = [];

        promises.push(utils.getSsmParam(ssm, 'connection_params'));
        promises.push(utils.getSsmParam(ssm, 'fhir_validation'));

        Promise.all(promises)
            .then(result => {
                resolve({
                    db_connection: result[0],
                    fhir_validation: result[1]
                });
            })
            .catch(err => {
                reject(err);
            });
    });
}

function formatGroupData(data) {
    let array = []

    array = data.map(item => {
        return parseInt(item.id, 10);
    });

    return array;
}

async function execute(event, client) {
    try {
        // inicializa variáveis
        const schema = event.db_schema;
        const group = event.bundle[0];
        const type = group.main.data.type;

        if (type === "site") {
            const insurancePlan = event.bundle[1];
            const groupData = formatGroupData(group.main.data.groupToUpdate);

            return await client.transaction(async trx => {
                try {
                    const data = await client
                        .raw(`select ${schema}.add_to_caresite(${insurancePlan.id}, array${JSON.stringify(groupData)}) as response;`)
                        .transacting(trx);

                    // monta resposta
                    return {
                        resourceType: 'Bundle',
                        id: uuidv4(),
                        type: 'transaction-response',
                        entry: [{
                            response: {
                                status: '201 Created',
                                location: `${event.base_url}/Group/${data.rows[0].response.group_id}?type=site`
                            }
                        },
                        {
                            response: {
                                status: '200 OK',
                                location: `${event.base_url}/InsurancePlan/${insurancePlan.id}`
                            }
                        }
                        ]
                    }
                } catch (err) {
                    let errorDetail;

                    try {
                        errorDetail = JSON.parse(err.detail);
                    } catch (error) {
                        throw err;
                    }

                    switch (errorDetail.http_status) {
                        case 404: {
                            throw utils.buildCustomError(404, `Recurso InsurancePlan/${errorDetail.id} não encontrado`);
                        }
                    }
                }
            });
        }
        else {
            const careTeam = event.bundle[1];
            const groupData = formatGroupData(group.main.data.patients);

            return await client.transaction(async trx => {
                try {
                    const data = await client
                        .raw(`select ${schema}.add_to_careteam(${careTeam.id}, array${JSON.stringify(groupData)}) as response;`)
                        .transacting(trx);

                    // monta resposta
                    return {
                        resourceType: 'Bundle',
                        id: uuidv4(),
                        type: 'transaction-response',
                        entry: [{
                            response: {
                                status: '201 Created',
                                location: `${event.base_url}/Group/${data.rows[0].response.group_id}?type=person`
                            }
                        },
                        {
                            response: {
                                status: '200 OK',
                                location: `${event.base_url}/CareTeam/${careTeam.id}`
                            }
                        }
                        ]
                    }
                } catch (err) {
                    let errorDetail;

                    try {
                        errorDetail = JSON.parse(err.detail);
                    } catch (error) {
                        throw err;
                    }

                    switch (errorDetail.http_status) {
                        case 404: {
                            throw utils.buildCustomError(404, `Recurso CareTeam/${errorDetail.id} não encontrado`);
                        }
                        case 409: {
                            throw utils.buildCustomError(409, `Recurso Patient/${errorDetail.id} já pertence a outro care team`);
                        }
                    }
                }
            });
        }
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
}

async function executeDatabaseOperations(event) {
    // obtém cliente PostgresSQL
    client = getClient(event.db_connection);

    // conecta no BD
    models.init(event.db_connection, event.db_schema);

    // executa a query no BD
    return await execute(event, client);
}

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    if (event.warmer) {
        console.log('LAMBDA WARMER> warmup successful');
        return 0;
    }

    try {
        env = event.env;
        const payload = utils.assertRequiredValue('payload', event.payload, 'object');
        const resourceType = utils.assertRequiredValue('resourceType', payload.resourceType, 'string');
        const db_schema = utils.assertRequiredValue('db_schema', event.db_schema, 'string');

        // obtém configurações
        const {
            fhir_validation,
            db_connection
        } = await getConfig();

        // converte objeto FHIR para OMOP
        const bundle = await fhirOmopConverter.fhirToOmop(event.env, payload, resourceType);

        const response = await executeDatabaseOperations({
            db_connection,
            db_schema,
            bundle,
            base_url: event.base_url
        });

        if (env === 'prd' && !event.skipmv) {
            // coloca a mensagem numa fila para ser persistida no histórico (DynamoDB)
            for (let i = 0; i < response.entry.length; i++) {
                const reference = response.entry[i].response.location;
                const dataArray = reference.split('/');
                const refResourceType = dataArray[0];
                const refId = parseInt(dataArray[1], 10);

                await utils.pushMessageToQueue(sqs, {
                    env: event.env,
                    base_url: event.base_url,
                    resourceType: refResourceType,
                    id: refId,
                    schema: event.db_schema,
                    modified: new Date().toISOString()
                }, `https://sqs.us-east-1.amazonaws.com/707583345549/message_history_${env}`);
            }
        }

        return response;
    } catch (err) {
        utils.handleError(err);
    }
};