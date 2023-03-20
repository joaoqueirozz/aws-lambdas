// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;

// Busca mapa do recurso
async function getResourceMap(env, resource) {
    try {

        const params = {
            TableName: `Broker-Omop_${env}`,
            KeyConditionExpression: "broker_resource = :broker_resource",
            ExpressionAttributeValues: {
                ":broker_resource": {
                    S: resource.toString()
                }
            },
        };

        let data = await dynamo.query(params).promise();

        data = data.Items && data.Items.length > 0 ? converter.unmarshall(data.Items[0]) : null;

        if (data)
            delete data.broker_resource;

        return data;

    } catch (err) {
        throw err;
    }
}

module.exports = {
    getResourceMap
}