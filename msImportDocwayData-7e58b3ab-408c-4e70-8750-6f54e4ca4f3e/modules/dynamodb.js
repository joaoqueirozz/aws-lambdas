// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;

// uuid
const { v4: uuidv4 } = require("uuid");

// Busca registro na tabela de controle Dynamo
async function getControl(resourceType, env, id) {
  const data = await dynamo
    .query({
      TableName: `${resourceType}Control_Import_${env}`,
      KeyConditionExpression:
        "id_external = :id_external and integration = :integration",
      ExpressionAttributeValues: {
        ":id_external": {
          S: id.toString(),
        },
        ":integration": {
          S: "Docway",
        },
      },
    })
    .promise();

  if (!data || !data.Items) {
    throw utils.buildCustomError(
      500,
      "Erro obtendo as atendimento da tabela de controle"
    );
  }

  return data.Items.length > 0 ? converter.unmarshall(data.Items[0]) : null;
}

// Insere registro na tabela de controle
async function updateControl(resourceType, env, id, externalId) {
  return await dynamo
    .putItem({
      TableName: `${resourceType}Control_Import_${env}`,
      Item: converter.marshall({
        id_external: externalId.toString(),
        integration: "Docway",
        id: parseInt(id, 10),
        created: new Date().toISOString(),
      }),
    })
    .promise();
}

// Insere tudo o que vier do appointment
async function createAppointment(data, env) {
  return await dynamo
    .putItem({
      TableName: `Docway_msImport_RawResponse_${env}`,
      Item: converter.marshall({
        id: uuidv4(),
        payload: JSON.stringify(data),
      }),
    })
    .promise();
}

module.exports = {
  getControl,
  updateControl,
  createAppointment,
};
