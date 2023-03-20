const fhirOmopConverter = require("fhir-omop-converter");
const models = require("models");
const utils = require("utils");
const { isEmpty, isArray, cloneDeep } = require("lodash");

// SSM
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

// SQS
const awsSQS = require("aws-sdk/clients/sqs");
const sqs = new awsSQS();

let env;

async function insertMedicalInfo(event) {
  models.init(event.db_connection, event.db_schema);
  return await require(`./entities/${event.resourceType}`).execute(
    models,
    event
  );
}

//TODO: Regra para preenchimento do atributo incoming_at
function isCoverageIncommingAt(omopData) {
  //TODO: Preenche o campo incoming_at com o valor do start_at
  if (!isEmpty(omopData.main.data) && !isEmpty(omopData.main.data.start_at)) {
    omopData.main.data["incoming_at"] = omopData.main.data.start_at;
  }
  return omopData;
}

async function getConfig() {
  return new Promise((resolve, reject) => {
    const promises = [];

    promises.push(utils.getSsmParam(ssm, "connection_params"));

    Promise.all(promises)
      .then((result) => {
        resolve({
          db_connection: result[0],
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
  // if (env === "prd") {
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
      methodType: "create",
    });

    console.log(`>>> ${JSON.stringify(message)} <<<`);
  } else {
    for (let index = 0; index < response.entry.length; index++) {
      const element = response.entry[index];

      const id = element.id;

      type = getOrganizationType(element.resource);

      // coloca a mensagem numa fila para ser persistida no histórico (DynamoDB)
      const message = await pushMessageToQueue({
        env,
        base_url,
        schema,
        resourceType: element.resource.resourceType,ms
        id,
        type,
        modified: new Date().toISOString(),
        messageId: `message-${resourceType.toLowerCase()}-${id}-${new Date().getTime()}`,
        groupId: createGroupIdMessage(env, response, resourceType, id),
        methodType: "create",
      });

      console.log(`>>> ${JSON.stringify(message)} <<<`);
    }
  }
  // }
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

    console.log(JSON.stringify(payload));

    // obtém configurações
    const { db_connection } = await getConfig();

    const type =
      resourceType === "Organization"
        ? utils.assertRequiredValue(
            "type",
            getOrganizationType(payload),
            "string"
          )
        : null;

    if (payload.generalPractitioner) {
      delete payload.generalPractitioner;
    }

    // Envia mensagem para a fila
    // await sendMessageSQS(event.base_url, event.db_schema, resourceType, type, response);

    const originalMessage = cloneDeep(payload);

    // converte objeto FHIR para OMOP
    let omopData = await fhirOmopConverter.fhirToOmop(
      event.env,
      payload,
      resourceType,
      type
    );

    //TODO: Regra para preenchimento do atributo incoming_at do Beneficiário
    omopData =
      resourceType === "Coverage" ? isCoverageIncommingAt(omopData) : omopData;

    // persiste o objeto no DW
    const response = await insertMedicalInfo({
      db_connection,
      db_schema: event.db_schema,
      data: omopData,
      resourceType: resourceType.toLowerCase(),
      type,
      payload: resourceType === "Bundle" ? originalMessage : null,
    });

    // Envia mensagem para a fila
    await sendMessageSQS(
      event.base_url,
      event.db_schema,
      resourceType,
      type,
      response,
      originalMessage
    );

    if (resourceType !== "Bundle") {
      originalMessage.id = parseInt(response.id, 10);
      originalMessage.resourceType = resourceType;
      return originalMessage;
    } else return response;
  } catch (err) {
    // utils.errorLog(err, env);
    utils.handleError(err);
  }
};
