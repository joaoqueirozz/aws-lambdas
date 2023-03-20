// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;


// Insere registro na tabela
async function updateHistory(attrs) {
    return await dynamo.putItem({
        TableName: 'DocwayDatabaseImports',
        Item: converter.marshall(attrs)
    }).promise();
}

module.exports = {
    updateHistory
}