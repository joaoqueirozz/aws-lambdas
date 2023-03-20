// layers
const fhirOmopConverter = require("fhir-omop-converter");
const models = require("models");
const utils = require("utils.js");
const got = require("got");
const pgknex = require("pgknex");

// S3
const s3Lib = require("aws-sdk/clients/s3");
const s3 = new s3Lib();

// SSM - Parâmetros
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

const bundleRequest = require("./bundleRequest.json");

let haocConfig;

let idType;
let id;
let count;

async function getHaocBundle(nrCpf) {
  const oid = `2.16.840.1.113883.13.237-${nrCpf}`;
  const body = JSON.stringify(bundleRequest).replaceAll("_OID_", oid);
  const url = `${haocConfig.bundleUrl}?PATIENT_OID=${oid}`;

  const result = await got.post(url, {
    headers: {
      ContentType: "application/fhir+json",
      Accept: "application/fhir+json",
      purposeofuse: "Atendimento", // Atendimento ou Emergencia (quebra de vidro)
      Authorization: `Bearer ${haocConfig.token}`,
    },
    responseType: "json",
    body: JSON.parse(body),
  }).json();

  console.log(JSON.stringify(result));

  return result;
}

async function saveToBucket(bundle, nrCpf) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-haoc",
        Key: `${new Date().getTime()}_${nrCpf}.json`,
        ContentType: "application/json",
        Body: JSON.stringify(bundle),
      })
      .promise();

    console.log("Armazenado no S3/sami-data-haoc");
  } catch (err) {
    throw err;
  }
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

async function insertMedicalInfo(event) {
  console.log(">>> Vai armazenar no DW <<<");
  // console.log(JSON.stringify(event));
  models.init(event.db_connection, event.db_schema);
  return await require(`./entities/${event.resourceType}`).execute(
    models,
    event
  );
}

function buildQueryLife(schema, patient) {
  const query = [];

  query.push(
    `select id from ${schema}.lives l where document_identification_primary = '${patient}' `
  );

  return query.join("");
}

function buildQueryRepetition(schema, typeOmop, idType, id) {
  const query = [];

  query.push(
    `select count(*) from ${schema}.${typeOmop} where ${idType} = ${id} `
  );

  return query.join("");
}

async function main(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // nada a ser processado na fila
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }

    const haocToken = await getHaocAccessToken();

    console.log(">>> Event <<<");

    // percorre as mensagens encontradas na fila (cada mensagem é um atendimento)
    for (const record of event.Records) {
      const body = utils.assertRequiredValue(
        "body",
        JSON.parse(record.body),
        "object"
      );

      console.log(JSON.stringify(body));

      const env = utils.assertRequiredValue("env", body.env, "string");

      console.log(`>>> Ambiente: ${env} <<<`);

      const schema = utils.assertRequiredValue(
        "db_schema",
        body.db_schema,
        "string"
      );

      console.log(`>>> Schema: ${schema} <<<`);

      const baseUrl = utils.assertRequiredValue(
        "base_url",
        body.base_url,
        "string"
      );

      console.log(`>>> URL: ${baseUrl} <<<`);

      haocAccessToken = utils.assertRequiredValue(
        "access_token",
        body.access_token,
        "string"
      );

      const { nrCpf } = utils.assertRequiredValue(
        "body.payload",
        body.payload,
        "object"
      );

      // console.log(`>>> nrAtendimento: ${nrAtendimento} <<<`);
      // console.log(`>>> MPI: ${cdMpi} <<<`);
      console.log(`>>> CPF: ${nrCpf} <<<`);
      // console.log(`>>> Tipo de Push: ${ieTipoMsg} <<<`);

      console.log(">>> Atendimento do membro na HAOC foi finalizado <<<");

      haocConfig = (await utils.getSsmParam(ssm, "haoc_config"))[env];

      const bundle = await getHaocBundle(haocAccessToken, nrCpf);

      await saveToBucket(bundle, nrCpf);

      //-------------------------------------------------------------------------------------------------
      // Encontrar o life_id do membro
      //-------------------------------------------------------------------------------------------------

      await pgknex.connect("connection_params");

      // Obtém o life_id do membro
      const member = await pgknex.select(buildQueryLife(schema, nrCpf));

      pgknex.disconnect();

      // console.log(member);

      const life_id = JSON.parse(JSON.stringify(member[0])).id;

      console.log(`>>> life_id no DW: ${life_id} <<<`);

      //-------------------------------------------------------------------------------------------------

      // Conversão FHIR-OMOP e Persistência no DW
      for (const entry of bundle.entry) {
        const resourceType = `${entry.resource.resourceType}_haoc`; // adiciona o "_haoc" do mapeamento

        // Os procedures enviados por eles ainda são os nossos e não precisam ser gravados
        if (resourceType !== "Procedure_haoc") {
          console.log(">>><<<");
          console.log(`>>> FHIR: ${resourceType} <<<`);

          //-----------------------------------------------------------------------------------------------
          // Adicionar o life_id nos recursos necessários (exceto no Practitioner)
          //-----------------------------------------------------------------------------------------------

          var resourceJson = entry.resource;

          resourceJson.care_site_id = "186";

          // adicionar life_id menos no Practitioner
          if (resourceType !== "Practitioner_haoc") {
            // console.log(">>> Não é um Practitioner <<<");

            resourceJson.life_id = life_id;
          }

          // console.log(JSON.stringify(resourceJson));

          // Conversão para objeto OMOP
          let omopData = await fhirOmopConverter.fhirToOmop(
            env,
            resourceJson,
            resourceType
          );

          // console.log(JSON.stringify(omopData));

          // Tipo de objeto OMOP do recurso
          const typeOmop = omopData.main.entity_name;
          console.log(`>>> OMOP: ${typeOmop} <<<`);

          //-----------------------------------------------------------------------------------------------

          console.log(">>> Objeto convertido de FHIR para OMOP <<<");

          // obtém configurações
          const { db_connection } = await getConfig();

          //-------------------------------------------------------------------------------------------------
          // Encontra recursos que já foram gravados antes
          //-------------------------------------------------------------------------------------------------

          if (typeOmop === "care_sites_providers") {
            idType = "id_external";
            id = omopData.main.data.id_external;

            await pgknex.connect("connection_params");

            const id_dw = await pgknex.select(
              buildQueryRepetition(schema, typeOmop, idType, id)
            );

            pgknex.disconnect();

            count = JSON.parse(JSON.stringify(id_dw[0])).count;
          } else if (typeOmop === "episodes") {
            // Persistir sempre / vem apenas uma vez e no atendimento específico
            count = "0";
          } else if (omopData.main.data.episode_id_external === nrAtendimento) {
            // Persistir apenas se fazer referência ao nrAtendimento do push
            console.log("Entou no if");
            count = "0";
          } else {
            // Recurso recebido anteriormente
            count = "1";
          }

          console.log(`>>> count = ${count} <<<`);

          if (count === "0" || count === 0) {
            console.log(
              `>>> Objeto do tipo ${typeOmop} não existente no DW <<<`
            );

            // Persistência no DW
            const response = await insertMedicalInfo({
              db_connection,
              db_schema: schema,
              data: omopData,
              resourceType: resourceType.toLowerCase(),
              type: null,
              payload: null,
            });

            console.log(">>> Armazenado no DW <<<");
          } else {
            console.log(
              `>>> Objeto do tipo ${typeOmop} já existente no DW <<<`
            );
          }

          // --------------------------------------------------------------------------------------------------
        }
      }
      console.log(">>><<<");
      console.log(">>> Bundle processado com sucesso <<<");
    }
  } catch (err) {
    utils.handleError(err);
  }
}

exports.handler = async (event, context) => {
  return await main(event, context);
};
