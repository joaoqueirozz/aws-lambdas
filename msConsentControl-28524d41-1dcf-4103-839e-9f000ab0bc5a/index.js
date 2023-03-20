// layers
const pgknex = require("pgknex");
const utils = require("utils.js");
const got = require("got");
const FormData = require("form-data");

// SSM - Parâmetros
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

// DynamoDB
const dynamodbLib = require("aws-sdk/clients/dynamodb");
const dynamo = new dynamodbLib();
const converter = dynamodbLib.Converter;

// SQS
const awsSQS = require('aws-sdk/clients/sqs');
const sqs = new awsSQS();

let consent_status;
let env;
let healthCard

// Obtem a carteirinha pelo Coverage
async function getHealthCard(id, column, schema) {
  await pgknex.connect("connection_params");

  const card = await pgknex.select(
    `select health_card_number from ${schema}.beneficiaries b where ${column} = '${id}' `
  );

  pgknex.disconnect();

  return card;
}

//FUNCTION
async function getToken() {
  var formdata = new FormData();
  formdata.append("grant_type", "client_credentials");
  formdata.append("client_id", "17688ec70aea4e179598dfae9a8b4d18");
  formdata.append("client_secret", "e1i3cNOX1BFW2NvAic14VcWULVH3f9Po");

  const body = await got
    .post("https://app-br.onetrust.com/api/access/v1/oauth/token", {
      headers: formdata.getHeaders(),
      body: formdata,
    })
    .json();

  if (!body || !body.access_token) {
    throw new Error("OneTrust access token not found");
  }

  return body.access_token;
}

//FUNCTION
async function checkConsent(identifier, token) {
  const body = await got
    .get(
      "https://app-br.onetrust.com/api/consentmanager/v1/datasubjects/profiles?purposeGuid=93524917-5c4b-4507-a50b-16262cb6df83",
      {
        headers: {
          "Content-Type": "application/json",
          identifier: identifier,
          Authorization: `Bearer ${token}`,
        },
      }
    )
    .json();

  if (body.content.length === 0) {
    consent_status = "EMPTY";
  } else if (
    body &&
    body.content &&
    body.content[0].Purposes &&
    body.content[0].Purposes[0].Status
  ) {
    consent_status = body.content[0].Purposes[0].Status;
  } else {
    return { error: "Membro inexistente na OneTrust" };
  }

  return consent_status;
}

// Insere registro na tabela de controle
async function insertControl(env, healthCard, status) {
  return await dynamo
    .putItem({
      TableName: `ConsentControl_${env}`,
      Item: converter.marshall({
        health_card_number: healthCard,
        date: new Date().toISOString().slice(0, 10),
        status: status,
      }),
    })
    .promise();
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

//FUNCTION
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    console.log(JSON.stringify(event));

    for (let index = 0; index < event.Records.length; index++) {
      const body = utils.assertRequiredValue(
        "body",
        JSON.parse(event.Records[index].body),
        "object"
      );
      const data = utils.assertRequiredValue("data", body.data, "object"); // ResourceType
      const schema = utils.assertRequiredValue("schema", body.schema, "string");
      const modified = utils.assertRequiredValue(
        "modified",
        body.modified,
        "string"
      );

      let id = utils.assertRequiredValue("id", body.id, "number");
      let resourceType = utils.assertRequiredValue(
        "resourceType",
        body.resourceType,
        "string"
      );
      let methodType = utils.assertRequiredValue(
        "methodType",
        body.methodType,
        "string"
      );

      env = utils.assertRequiredValue("env", body.env, "string");

      console.log(JSON.stringify(body));
      console.log(`>>> ${resourceType} <<<`);
      console.log(`>>> ${methodType} <<<`);
      console.log(`>>> ${id} <<<`);
      console.log(`>>> ${data.status} <<<`); // undefined quando é Patient

      if(resourceType === "Coverage") {
        healthCard = await getHealthCard(id, "id", schema);
      }
      if(resourceType === "Patient") {
        healthCard = await getHealthCard(id, "life_id", schema);
      }
      if(resourceType === "Contract") {
        healthCard = await getHealthCard(id, "contract_id", schema)
      }

      console.log(`>>> Carteirinha: ${healthCard[0].health_card_number} <<<`);

      const token = await getToken();

      const status = await checkConsent(healthCard[0].health_card_number, token);

      console.log(`>>> status: ${status} <<<`);

      await insertControl(env, healthCard[0].health_card_number, status);

      body.health_card_number = healthCard[0].health_card_number;
      body.consent_status = status;

      // Envia mensagem para a fila de envio de membros para o HAOC
      await pushMessageToQueue(body, `https://sqs.us-east-1.amazonaws.com/707583345549/prd_export_haoc.fifo`);
    }

    return;
  } catch (err) {
    utils.handleError(err);
  }
};
