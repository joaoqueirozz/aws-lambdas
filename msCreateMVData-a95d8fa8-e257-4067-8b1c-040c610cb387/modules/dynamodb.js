// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;

// Busca registro na tabela de controle Dynamo
async function getControlTable(env, resourceType, id) {
    try {

        const params = {
            TableName: `${resourceType}Control_Export_${env}`,
            KeyConditionExpression: "id = :id and integration = :integration",
            ExpressionAttributeValues: {
                ":id": {
                    N: id.toString()
                },
                ":integration": {
                    S: "Mv"
                },
            },
        };

        const data = await dynamo.query(params).promise();

        if (data.Items && data.Items.length > 0) {
            console.log(`>>> ${resourceType} - ${id} localizado na tabela de Controle <<<`)
            return converter.unmarshall(data.Items[0])
        } else {
            console.log(`>>> ${resourceType} - ${id} não localizado na tabela de Controle <<<`);
            return null;
        }
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
            integration: 'Mv',
            created
        };

        const params = {
            Item: converter.marshall(data),
            TableName: `${resourceType}Control_Export_${env}`,
        };

        await dynamo.putItem(params).promise();
        console.log(">>> Dados gravado na tabela de controle de ID's <<<");

    } catch (err) {
        throw err;
    }
}

module.exports = {
    getControlTable,
    updateControlTable
}