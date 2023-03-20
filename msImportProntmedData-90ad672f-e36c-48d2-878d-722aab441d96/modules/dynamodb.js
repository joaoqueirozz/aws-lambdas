// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;

// Busca registro na tabela de controle Dynamo
async function getControlTable(env, resourceType, id) {
    try {

        const params = {
            TableName: `${resourceType}Control_Import_${env}`,
            KeyConditionExpression: 'id_external = :id_external and integration = :integration',
            ExpressionAttributeValues: {
                ":id_external": {
                    S: id.toString()
                },
                ":integration": {
                    S: 'Prontmed'
                },
            },
        };

        const data = await dynamo.query(params).promise();

        return data.Items && data.Items.length > 0 ? converter.unmarshall(data.Items[0]) : null;

    } catch (err) {
        throw err;
    }
}

// Insere registro na tabela de controle
async function updateControlTable(env, resourceType, id, idExternal, created) {
    try {
        let data = {
            id: Number(id),
            id_external: idExternal.toString(),
            integration: 'Prontmed',
            created
        };

        const params = {
            Item: converter.marshall(data),
            TableName: `${resourceType}Control_Import_${env}`,
        };

        return await dynamo.putItem(params).promise();
    } catch (err) {
        throw err;
    }
}

module.exports = {
    getControlTable,
    updateControlTable
}