// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;

// Busca registro na tabela de controle Dynamo
async function getControl(resourceType, env, primaryId, secundaryId) {
    let param = {
        TableName: `${resourceType}Control_Import_${env}`,
        ExpressionAttributeValues: {
            ':id_external': {
                S: primaryId.toString()
            },
            ':integration': {
                S: 'Mv'
            }
        }
    };

    if (secundaryId) {
        param.FilterExpression = 'id_external = :id_external and integration = :integration and id_external_secundary = :id_external_secundary';
        param.ExpressionAttributeValues[':id_external_secundary'] = { S: secundaryId.toString() };
    }
    else
        param.KeyConditionExpression = 'id_external = :id_external and integration = :integration';

    let data;

    if (!secundaryId)
        data = await dynamo.query(param).promise();
    else {
        do {
            data = await dynamo.scan(param).promise();

            if (data.Items && data.Items.length > 0) {
                return data.Items[0];
            }

            // Possui páginas extras, realiza novamente o scan
            else if (data.LastEvaluatedKey) {
                params.ExclusiveStartKey = data.LastEvaluatedKey;
            }

        } while (!data || data.LastEvaluatedKey);
    }

    if (!data || !data.Items) {
        throw utils.buildCustomError(500, 'Erro obtendo as atendimento da tabela de controle');
    }

    return (data.Items.length > 0) ? converter.unmarshall(data.Items[0]) : null;
}

// Insere registro na tabela de controle
async function updateControl(resourceType, env, primaryId, secundaryId, id) {

    let data = {
        id_external: primaryId.toString(),
        integration: 'Mv',
        id: parseInt(id, 10),
        created: (new Date()).toISOString()
    };

    if (secundaryId)
        data['id_external_secundary'] = secundaryId.toString();

    const params = {
        Item: converter.marshall(data),
        TableName: `${resourceType}Control_Import_${env}`
    };

    return await dynamo.putItem(params).promise();
}

module.exports = {
    getControl,
    updateControl
}