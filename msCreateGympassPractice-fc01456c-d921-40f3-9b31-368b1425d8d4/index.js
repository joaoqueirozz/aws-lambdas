const utils = require('utils.js');

// SQS
const awsSQS = require('aws-sdk/clients/sqs');
const sqs = new awsSQS();

let env;

async function pushMessageToQueue(params, url) {
    return await sqs.sendMessage({
        QueueUrl: url,
        MessageBody: JSON.stringify(params)
    }).promise();
}

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    try {
        env = event.env;
        const payload = utils.assertRequiredValue('payload', event.payload, 'object');
        const base_url = utils.assertRequiredValue('base_url', event.base_url, 'string');
        const resourceType = utils.assertRequiredValue('resourceType', payload.resourceType, 'string');
        const entry = utils.assertRequiredValue('entry', payload.entry, 'object');
        const db_schema = utils.assertRequiredValue('db_schema', event.db_schema, 'string');
        const dw_schema = utils.assertRequiredValue('dw_schema', event.dw_schema, 'string');
        const timestamp = new Date().getTime();

        await pushMessageToQueue({
            event,
            modified: new Date().toISOString(),
        }, `https://sqs.us-east-1.amazonaws.com/707583345549/import_gympass`);

        return {
            "resourceType": "Bundle",
            "id": "1acc2e00-c1bd-4a78-a4cc-0e80777e2d84",
            "type": "transaction-response",
            "entry": [{
                    "response": {
                        "status": "200 OK",
                        "type": "Patient"
                    }
                },
                {
                    "response": {
                        "status": "201 Created",
                        "type": "Appointment"
                    }
                }
            ]
        }
    } catch (err) {
        utils.handleError(err);
    }
};