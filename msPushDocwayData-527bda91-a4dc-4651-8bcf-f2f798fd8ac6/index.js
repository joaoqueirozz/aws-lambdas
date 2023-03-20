// Layers
const utils = require("utils");

// SQS
const awsSQS = require('aws-sdk/clients/sqs');
const sqs = new awsSQS();

// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;

// uuid
const { v4: uuidv4 } = require("uuid");

// SSM
const awsSSM = require('aws-sdk/clients/ssm');
const ssm = new awsSSM();

async function pushMessageToQueue(sqs, params, url) {
    try {
        return await sqs.sendMessage({
            QueueUrl: url,
            DelaySeconds: '0',
            MessageBody: JSON.stringify(params)
        }).promise();
    } catch (err) {
        throw err;
    }
}


// Insere tudo o que vier do appointment
async function createNotification(data, env) {
    return await dynamo.putItem({
        TableName: `Docway_msPush_RawResponse_${env}`,
        Item: converter.marshall({
            id: uuidv4(),
            payload: JSON.stringify(data)
        })
    }).promise();
}

exports.handler = async(event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    console.log('INICIO: ', event)
    
    try {
        await createNotification(event, event.env)    
    } catch (error) {
        
    }

    const env = event.env;

    try {
        const proceed = (await utils.getSsmParam(ssm, 'docway'))['all']['proceedIntegration'][event.payload.eventType];

        if (proceed) {
            await pushMessageToQueue(sqs, event, `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_import_docway`);

            return {
                message: 'Mensagem entregue com sucesso'
            }
        }

        return {
            message: `O evento ${event.payload.eventType} foi desconsiderado`
        }

    } catch (err) {
        utils.handleError(err);
    }
};