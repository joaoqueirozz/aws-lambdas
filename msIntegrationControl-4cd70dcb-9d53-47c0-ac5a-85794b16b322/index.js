// layers
const utils = require("utils.js");

// Lambda
const lambdaLib = require("aws-sdk/clients/lambda");
const lambda = new lambdaLib();

// SSM
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

// SQS
const awsSQS = require('aws-sdk/clients/sqs');
const sqs = new awsSQS();

// DynamoDB
const awsDynamodb = require("aws-sdk/clients/dynamodb");
const dynamo = new awsDynamodb();
const converter = awsDynamodb.Converter;

let env;

// Verifica se o recurso é de integração do sistema
async function isIntegrationSystem(integrationSystem, resourceType, methodType) {
  return (integrationSystem[resourceType] && integrationSystem[resourceType].includes(methodType));
}

// Busca registro FHIR do recurso
async function getFhirObject(resourceType, db_schema, id, type, base_url) {
  const data = await utils.invokeLambda(lambda, `msGetMedicalInfo:${env}`, {
    env,
    resourceType,
    db_schema,
    id,
    type,
    base_url,
    history: true,
  });

  return data;
}

// Método de envio de mensagens para uma determina fila
async function pushMessageToQueue(params, url) {
  try {
    return await sqs.sendMessage({
      QueueUrl: url,
      MessageBody: JSON.stringify(params),
      MessageDeduplicationId: params.messageId.toString(),
      MessageGroupId: params.groupId.toString()
    }).promise();
  } catch (err) {
    throw err;
  }
}

// Envia mensagem de erro para o Slack
function sendMessageError(resourceType, id, modified, err) {
  if (env === "prd") utils.invokeLambda(lambda, `msSlackChatBot`, { lambda: "msIntegrationControl", resourceType, id, modified, err });
}

// Insere na tabela de histórico Dynamo
async function insertTableHistory(resourceType, id, data, modified) {
  try {
    data.id = id;
    data.modified = modified;

    const params = {
      Item: converter.marshall(data),
      TableName: `${resourceType}History_${env}`,
    };

    return await dynamo.putItem(params).promise();
  } catch (err) {
    throw err;
  }
}

exports.handler = async (event, context, callback) => {

  let resourceType = "";
  let id = 0;
  let modified = "";

  try {
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }

    for (let index = 0; index < event.Records.length; index++) {
      const body = utils.assertRequiredValue("body", JSON.parse(event.Records[index].body), "object");
      const base_url = utils.assertRequiredValue("base_url", body.base_url, "string");
      const schema = utils.assertRequiredValue("schema", body.schema, "string");
      const type = body.type;
      const methodType = utils.assertRequiredValue("methodType", body.methodType, "string");

      resourceType = utils.assertRequiredValue("resourceType", body.resourceType, "string");
      modified = utils.assertRequiredValue("modified", body.modified, "string");
      id = utils.assertRequiredValue("id", body.id, "number");

      env = utils.assertRequiredValue("env", body.env, "string");

      console.log(`>>> ${JSON.stringify(env)} <<<`);
      console.log(`>>> ${JSON.stringify(resourceType)} <<<`);
      console.log(`>>> ${JSON.stringify(id)} <<<`);
      console.log(`>>> ${JSON.stringify(methodType)} <<<`);

      // Obtém o objeto modificado do DW
      body['data'] = await getFhirObject(resourceType, schema, id, type, base_url);

      // Busca mapa de integração dos sistemas
      const integration = await utils.getSsmParam(ssm, "integration_control")

      for (system in integration[env]) {
        // Verifica se o recurso é de integração do sistema
        if (await isIntegrationSystem(integration[env][system], resourceType, methodType)) {
          console.log(`>>> Mensagem enviada para ${JSON.stringify(system)} <<<`)
          // Envia mensagem para fila de cada sistema mapeado
          await pushMessageToQueue(body, `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_export_${system}.fifo`);
        }
      }

      if(env === 'prd'){
        console.log(`>>> Mensagem enviada para msConsentControl <<<`)
        // Envia mensagem para fila da checagem de consentimento do membro
        await pushMessageToQueue(body, `https://sqs.us-east-1.amazonaws.com/707583345549/prd_control_consent.fifo`);
      }

      // Persiste no histórico de mensagens
      await insertTableHistory(resourceType, id, body['data'], modified);
      console.log(`>>> Inserido na tabela de histórico <<<`);

    }

    return { message: "Gravação realizada com sucesso" };

  } catch (err) {
    sendMessageError(resourceType, id, modified, err);
    utils.handleError(err);
  }
};
