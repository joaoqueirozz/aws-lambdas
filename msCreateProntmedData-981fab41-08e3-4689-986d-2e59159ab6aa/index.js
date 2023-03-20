// Layers
const utils = require("utils");
const models = require("models");
const mapping = require("dataMapping");
const pgknex = require("pgknex");

// Map
const enums = require("./map/enumerators");

// DynamoDB
const awsDynamodb = require("aws-sdk/clients/dynamodb");

const dynamo = new awsDynamodb();
const converter = awsDynamodb.Converter;

// SSM
const ssmLib = require("aws-sdk/clients/ssm");

const ssm = new ssmLib();

// Lambda
const lambdaLib = require("aws-sdk/clients/lambda");

const lambda = new lambdaLib();

// SQS
const awsSQS = require("aws-sdk/clients/sqs");
const sqs = new awsSQS();

let env;

let effectiveDate;

global.fetch = require("node-fetch");

exports.handler = async (event) => {
  if (event.warmer) return 0;

  try {
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }

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

      console.log(`>>> ${env} <<<`);
      console.log(`>>> ${resourceType} <<<`);
      console.log(`>>> ${methodType} <<<`);
      console.log(`>>> ${id} <<<`);
      console.log(`>>> ${data.status} <<<`); // undefined quando é Patient

      try {
        // Verificar data de vigência (Coverage já tem / Patient não tem)
        if (resourceType === "Coverage") {
          effectiveDate = data.period.start;
        } else {
          await pgknex.connect("connection_params");

          // Query para encontrar a data de vigência do Patient
          const vigencia = await pgknex.select(buildQueryVigencia(schema, id));

          pgknex.disconnect();

          effectiveDate = JSON.parse(JSON.stringify(vigencia[0])).start_at;
        }

        console.log(`>>> Data de vigência: ${effectiveDate} <<<`);
        console.log(
          `>>> Vigente: ${new Date() >= new Date(effectiveDate)} <<<`
        ); // teste
      } catch (err) {
        throw err;
      }

      // Veriricar tipo Coverage ou Patient
      const patient = resourceType === "Patient"; //true para Patient
      resourceType = resourceType === "Patient" ? "Coverage" : resourceType; // resourceType = Coverage

      try {
        const connection = await utils.getSsmParam(ssm, "connection_params");
        // Conecta no BD
        models.init(connection, schema);

        // Executa a query no BD
        const dataPayload =
          await require(`./entities/${resourceType.toLowerCase()}`).execute(
            id,
            models,
            patient
          );
        if (dataPayload) {
          id = patient ? dataPayload.id : id;

          // Busca os ids na tabela de controle
          let controlItem = await getControlTable(resourceType, id);

          console.log(
            controlItem
              ? ">>> Já existe na tabela de Controle <<<"
              : ">>> Não existe na tabela de Controle <<<"
          );

          methodType = !controlItem ? "create" : "update";
          methodType = controlItem && patient ? "update" : methodType;

          // Converte valores para Importação
          let payload = await mapping.convertDataMapping(
            env,
            models,
            "Prontmed",
            resourceType,
            dataPayload,
            enums,
            "Export",
            methodType
          );

          payload = convertPayload(resourceType, payload, dataPayload);

          // adicionar a condição de arquivado aqui para caso de não vigência
          if (
            (await isIntegrationProntmed(resourceType, data, patient)) &&
            new Date() <= new Date(effectiveDate)
          ) {
            console.log(">>> Membro fora de vigência <<<"); // Antes o membro era arquivado até seu vigenciamento, agora ele não deve ser enviado até essa data
            // payload.arquivado = true;
            return 0;
          }

          console.log(`>>> ${JSON.stringify(payload)} <<<`);

          if (payload) {
            // Envia os dados para a API
            const response = await importData(payload, methodType);
            console.log(`>>> ${JSON.stringify(response)} <<<`);

            if (response.status === 200 && response.id_prontmed) {
              if (methodType === "create") {
                await insertControlTable(
                  resourceType,
                  id,
                  response.id_prontmed,
                  modified
                );
                console.log(
                  ">>> Dados gravado na tabela de controle de ID's <<<"
                );
                console.log(">>> Realizada gravação na Prontmed <<<");
              } else console.log(">>> Realizada atualização na Prontmed <<<");
            } else
              throw JSON.stringify(
                utils.buildCustomError(
                  500,
                  `Erro importação Prontmed ${response}`
                )
              );
          } else
            throw JSON.stringify(
              utils.buildCustomError(
                500,
                `Erro importação Prontmed ${response}`
              )
            );
        }
      } catch (err) {
        console.log(JSON.stringify(err));
        // sendMessageError(resourceType, id, modified, err);
        utils.handleError(err);
      } finally {
        models.destroy();
      }
    }
  } catch (err) {
    utils.handleError(err);
  }
};

// Método de envio de mensagens para uma determina fila
async function pushMessageToQueue(params, url) {
  try {
    return await sqs
      .sendMessage({
        QueueUrl: url,
        MessageBody: JSON.stringify(params),
        MessageDeduplicationId: params.messageId.toString(),
        MessageGroupId: params.groupId.toString(),
      })
      .promise();
  } catch (err) {
    throw err;
  }
}

function buildQueryVigencia(schema, id) {
  const query = [];

  query.push(
    `select start_at from ${schema}.beneficiaries b where life_id = ${id} `
  );

  return query.join("");
}

// Converte o payload de acordo com as regras do parceiro
function convertPayload(resourceType, payload, data) {
  if (resourceType === "Coverage" && !payload.dependente.titular)
    payload.dependente = null;
  return payload;
}

// Importa os dados para a Prontmed
async function importData(payload) {
  let param = await utils.getSsmParam(ssm, "prontmed-integration-config");
  param = param[env];

  return new Promise((resolve, reject) => {
    fetch(param.url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        ApiKey: param.key,
        ApiPassword: param.password,
        "Content-Type": "application/json",
      },
    })
      .then(safeParseJSON)
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        console.log(JSON.stringify(err));
        reject(err);
      });
  });
}

// Formata retorno
async function safeParseJSON(response) {
  const body = await response;
  const id = JSON.parse(await body.text());

  try {
    return {
      id_prontmed: id.id,
      status: response.status,
    };
  } catch (err) {
    throw err;
  }
}

// Busca registro na tabela de controle Dynamo
async function getControlTable(resourceType, id) {
  try {
    const params = {
      TableName: `${resourceType}Control_Export_${env}`,
      KeyConditionExpression: "id = :id and integration = :integration",
      ExpressionAttributeValues: {
        ":id": {
          N: id.toString(),
        },
        ":integration": {
          S: "Prontmed",
        },
      },
    };

    const data = await dynamo.query(params).promise();

    return data.Items && data.Items.length > 0
      ? converter.unmarshall(data.Items[0])
      : null;
  } catch (err) {
    throw err;
  }
}

// Verifica se é recurso de integração Prontmed
async function isIntegrationProntmed(resourceType, data, patient) {
  return (
    (resourceType === "Coverage" &&
      !patient &&
      (data.status === "active" || data.status === "cancelled")) ||
    patient
  );
}

// Insere registro na tabela de controle
async function insertControlTable(resourceType, id, idExternal, created) {
  try {
    let data = {
      id: Number(id),
      id_external: idExternal.toString(),
      integration: "Prontmed",
      created,
    };

    const params = {
      Item: converter.marshall(data),
      TableName: `${resourceType}Control_Export_${env}`,
    };
    return await dynamo.putItem(params).promise();
  } catch (err) {
    throw err;
  }
}

// Envia mensagem de erro para o Slack
function sendMessageError(resourceType, id, modified, err) {
  if (env === "prd") {
    utils.invokeLambda(lambda, "msSlackChatBot", {
      lambda: "msCreateProntmedData",
      resourceType,
      id,
      modified,
      err,
    });
  }
}
