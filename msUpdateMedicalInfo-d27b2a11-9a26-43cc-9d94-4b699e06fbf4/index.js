const fhirOmopConverter = require("fhir-omop-converter");
const redisCache = require("redis-cache");
const utils = require("utils.js");
const knex = require("knex");
const models = require("models");
const { isArray, cloneDeep } = require("lodash");

const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();
const awsSQS = require("aws-sdk/clients/sqs");
const sqs = new awsSQS();

let client;
let env;

function getClient(connection) {
  return knex({
    client: "pg",
    connection,
  });
}

async function updateMedicalInfo(event) {
  // obtém cliente PostgresSQL
  client = getClient(event.db_connection);

  models.init(event.db_connection, event.db_schema);

  // executa a query no BD
  const response = await require(`./entities/${event.resourceType}`).execute(
    event,
    client,
    models
  );

  // qualquer alteração no banco repercute em diversas entidades.
  // para evitar qualquer problema de integridade, limpamos a cache
  await redisCache.clearCache(event.cacheConfig);

  return response;
}

async function getConfig() {
  return new Promise((resolve, reject) => {
    const promises = [];

    promises.push(utils.getSsmParam(ssm, "connection_params"));
    promises.push(utils.getSsmParam(ssm, "cache_config"));

    Promise.all(promises)
      .then((result) => {
        resolve({
          db_connection: result[0],
          cacheConfig: result[1],
        });
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function getOrganizationType(payload) {
  if (isArray(payload.type) && isArray(payload.type[0].coding)) {
    if (
      payload.type[0].coding[0].code === "ins" ||
      payload.type[0].coding[0].code === "pay" ||
      payload.type[0].coding[0].code === "prov"
    ) {
      return payload.type[0].coding[0].code;
    }
  }

  return;
}
// Método de envio de mensagens para uma determina fila
async function pushMessageToQueue(params) {
  try {
    return await sqs
      .sendMessage({
        QueueUrl: `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_export_dw.fifo`,
        MessageBody: JSON.stringify(params),
        MessageDeduplicationId: params.messageId.toString(),
        MessageGroupId: params.groupId.toString(),
      })
      .promise();
  } catch (err) {
    throw err;
  }
}

// Envia mensagem para a fila
async function sendMessageSQS(base_url, schema, resourceType, type, response) {
  //   if (env === "prd") {
  if (resourceType !== "Bundle") {
    const id = response.id ? response.id : response.insertedId;

    // coloca a mensagem numa fila para ser persistida no histórico (DynamoDB)
    const message = await pushMessageToQueue({
      env,
      base_url,
      schema,
      resourceType,
      id,
      type,
      modified: new Date().toISOString(),
      messageId: `message-${resourceType.toLowerCase()}-${id}-${new Date().getTime()}`,
      groupId: createGroupIdMessage(env, response, resourceType, id),
      methodType: "update",
    });

    console.log(`>>> ${JSON.stringify(message)} <<<`);
  } else {
    const code = new Date().getTime();

    for (let index = 0; index < response.entry.length; index++) {
      const element = response.entry[index];

      const id = element.id;

      type = getOrganizationType(element.resource);

      // coloca a mensagem numa fila para ser persistida no histórico (DynamoDB)
      const message = await pushMessageToQueue({
        env,
        base_url,
        schema,
        resourceType: element.resource.resourceType,
        id,
        type,
        modified: new Date().toISOString(),
        messageId: `message-${resourceType.toLowerCase()}-${id}-${new Date().getTime()}`,
        groupId: createGroupIdMessage(env, response, resourceType, id),
        methodType: "update",
      });

      console.log(`>>> ${JSON.stringify(message)} <<<`);
    }
  }
  //   }
}

function createGroupIdMessage(env, response, resourceType, resourceId) {
  if (resourceType === "Coverage") resourceId = response["contract_id"];

  return resourceType === "Contract" || resourceType === "Coverage"
    ? `${env}-Contract-${resourceId}`
    : resourceType === "Bundle"
    ? `${env}-${resourceType}`
    : `${env}-${resourceType}-${resourceId}`;
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  env = event.env;

  if (event.warmer) return 0;

  try {
    const payload = utils.assertRequiredValue(
      "payload",
      event.payload,
      "object"
    );
    const resourceType =
      event.resourceType && event.resourceType.length > 0
        ? event.resourceType
        : "Bundle";
    const type =
      resourceType === "Organization"
        ? utils.assertRequiredValue(
            "type",
            getOrganizationType(payload),
            "string"
          )
        : null;
    const id = utils.assertRequiredValue("id", event.id, "number");

    console.log(JSON.stringify(payload));

    // obtém configurações
    const { db_connection, cacheConfig } = await getConfig();

    const originalMessage = cloneDeep(payload);

    // converte objeto FHIR para OMOP
    const jsonData = await fhirOmopConverter.fhirToOmop(
      event.env,
      payload,
      resourceType,
      type
    );
    resourceType !== "Bundle" ? (jsonData.main.data.id = id) : null;

    // persiste o objeto no DW
    const response = await updateMedicalInfo({
      db_connection,
      db_schema: event.db_schema,
      id,
      data: jsonData,
      resourceType: resourceType.toLowerCase(),
      type,
      cacheConfig: cacheConfig[env],
      payload: resourceType === "Bundle" ? originalMessage : null,
    });

    await sendMessageSQS(
      event.base_url,
      event.db_schema,
      resourceType,
      type,
      response
    );

    // atribui id inserido na mensagem original
    if (resourceType !== "Bundle") {
      originalMessage.id = parseInt(response.id, 10);
      originalMessage.resourceType = resourceType;
      return originalMessage;
    } else return response;
  } catch (err) {
    utils.errorLog(err, env);
    utils.handleError(err);
  }
};
