const pgknex = require("pgknex");
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  if (env === "prd") {
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
  }
}

function queryEligible(today) {
  const query = [];

  query.push(`select id from datawarehouse.beneficiaries b `);
  query.push(`where status_source_value = 'active' and start_at = '${today}' `);
  query.push(`order by id `);

  return query.join("");
}

function createGroupIdMessage(env, response, resourceType, resourceId) {
  if (resourceType === "Coverage") resourceId = response["contract_id"];

  return resourceType === "Contract" || resourceType === "Coverage"
    ? `${env}-Contract-${resourceId}`
    : resourceType === "Bundle"
    ? `${env}-${resourceType}`
    : `${env}-${resourceType}-${resourceId}`;
}

exports.handler = async (event, context, callback) => {
  // console.log(context); // temp
  // console.log(event); // temp
  // console.log(callback); // temp

  console.log(">>> Envio de elegíveis do dia <<<");

  env = "prd";

  try {
    const payload = {};
    const resourceType = "Coverage";
    const type = null;

    // Obtem o dia atual
    const date = new Date();
    const year = date.toISOString().slice(0, 4);
    const month = date.toISOString().slice(5, 7);
    const day = date.toISOString().slice(8, 10);
    const today = `${year}-${month}-${day}`;
    // const today = "2022-08-16"; // temporário para reprocessamentos

    console.log(`>>> Data de hoje: ${today} <<<`);

    await pgknex.connect("connection_params");

    // obtem os IDs de beneficiaries
    const result = await pgknex.select(queryEligible(today));

    pgknex.disconnect();

    console.log(result);
    console.log(`>>> Qtd. de Membros: ${result.length} <<<`);

    const originalMessage = cloneDeep(payload);

    // obtém configurações
    const { db_connection, cacheConfig } = await getConfig();

    // assegurar que quando o result vir vazio [] a rotina acaba
    if (result.length > 0) {
      // fazer o update de cada ID
      for (let i = 0; i < result.length; i++) {
        const id = utils.assertRequiredValue("id", result[i].id, "number");

        // converte objeto FHIR para OMOP
        const jsonData = await fhirOmopConverter.fhirToOmop(
          env,
          payload,
          resourceType,
          type
        );

        jsonData.main.data.id = id;

        // persiste o objeto no DW
        const response = await updateMedicalInfo({
          db_connection,
          db_schema: "datawarehouse",
          id,
          data: jsonData,
          resourceType: resourceType.toLowerCase(),
          type,
          cacheConfig: cacheConfig[env],
          payload: null,
        });

        console.log(response);

        await sendMessageSQS(
          "https://n9im7t03ha.execute-api.us-east-1.amazonaws.com/production/fhir",
          "datawarehouse",
          resourceType,
          type,
          response
        );
        
        await sleep(2000);
      }
    } else {
      console.log(">>> Nenhum membro entrando em vigência hoje <<<");
    }

    callback(null, "Finished");

    return result;
  } catch (err) {
    utils.errorLog(err, env);
    utils.handleError(err);
  }
};
