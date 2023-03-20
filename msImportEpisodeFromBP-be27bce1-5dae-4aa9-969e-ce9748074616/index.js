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

// Modules
const rds = require("./modules/rds");

let bpConfig;

let idType;
let id;
let count;

async function getBpAccessToken() {
  try {
    const {
      AUTH_URL: authUrl,
      AUTH_TYPE: authType,
      CLIENT_ID: clientId,
      CLIENT_SECRET: clientSecret,
    } = bpConfig;
    const result = await got.post(authUrl, {
      headers: {
        "Content-Type": "application/json",
      },
      json: {
        grant_type: authType,
        client_id: clientId,
        client_secret: clientSecret,
      },
      responseType: "json",
    });
    return result.body.access_token;
  } catch (err) {
    throw err;
  }
}

async function getBundle(token, encounter, patient) {
  try {
    const { BASE_URL: baseUrl, BUNDLE_QUERYSTRING: bundleQuerystring } =
      bpConfig;

    const result = await got(
      `${baseUrl}?${bundleQuerystring
        .replace("##encounter##", encounter)
        .replace("##patient##", patient)}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        responseType: "json",
      }
    );

    console.log(JSON.stringify(result.body));

    return result.body;
  } catch (err) {
    throw err;
  }
}

async function saveBucket(bundle, nrAtendimento, life_id) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: `bp/${new Date()
          .toISOString()
          .slice(0, 10)}/${life_id}_${nrAtendimento}.json`,
        ContentType: "application/json",
        Body: JSON.stringify(bundle),
      })
      .promise();

    console.log(">>> Armazenado no s3://sami-data-interoperabilidade/bp/ <<<");
  } catch (err) {
    throw err;
  }
}

// Armazena no S3 (Rotina 0 do Recop)
async function recopSaveRaw(pacote, path) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: path,
        ContentType: "application/json",
        Body: JSON.stringify(pacote),
      })
      .promise();

    console.log(
      `>>> Armazenado no s3://sami-data-interoperabilidade/${path} <<<`
    );
  } catch (err) {
    throw err;
  }
}

async function getConfig() {
  return new Promise((resolve, reject) => {
    const promises = [];

    promises.push(utils.getSsmParam(ssm, "/Interop/igor_params"));

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
  models.init(event.db_connection, event.db_schema);
  return await require(`./entities/${event.resourceType}`).execute(
    models,
    event
  );
}

function buildQueryLife(schema, cpf, name) {
  const query = [];

  query.push(
    `select id from ${schema}.lives l where document_identification_primary = '${cpf}' or name like '%${name}%' `
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

// Confere se já existe o hash
function buildQueryHash(hash) {
  const query = [];

  query.push(`select vezes_recebido from recop.tac t where hash = '${hash}' `);

  return query.join("");
}

// Envia mensagem de erro para o bot do Slack
// function sendMessageError(resourceType, id, modified, err) {
//   if (env === "prd") {
//     utils.invokeLambda(lambda, "msSlackChatBotInterop", {
//       lambda: "msImportEpisodeFromBP",
//       resourceType,
//       id,
//       modified,
//       err,
//     });
//   }
// }

async function main(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // nada a ser processado na fila
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }

    // RequestId do evento no CloudWatch
    const aws_request_id = context.awsRequestId;

    // percorre as mensagens encontradas na fila (cada mensagem é um atendimento)
    for (const record of event.Records) {
      const body = utils.assertRequiredValue(
        "body",
        JSON.parse(record.body),
        "object"
      );

      console.log(JSON.stringify(body));

      const env = utils.assertRequiredValue("env", body.env, "string");

      console.log(`>>> env: ${env} <<<`);

      const schema = utils.assertRequiredValue(
        "db_schema",
        body.db_schema,
        "string"
      );

      console.log(`>>> schema: ${schema} <<<`);

      // const baseUrl = utils.assertRequiredValue(
      //   "base_url",
      //   body.base_url,
      //   "string"
      // );

      const { nrAtendimento, cdMpi, nmPaciente, nrCpf, ieTipoMsg } =
        utils.assertRequiredValue("body.payload", body.payload, "object");

      console.log(`>>> ID Externo do Atendimento: ${nrAtendimento} <<<`);
      console.log(`>>> Membro: ${nmPaciente} <<<`);
      // console.log(`>>> MPI: ${cdMpi} <<<`);
      console.log(`>>> CPF: ${nrCpf} <<<`);
      console.log(`>>> Tipo de Push: ${ieTipoMsg} <<<`);

      // Mensagem do tipo 2 representa fim de um atendimento
      if (ieTipoMsg === 2 || ieTipoMsg === "2") {
        console.log(">>> Atendimento Finalizado <<<");

        bpConfig = (await utils.getSsmParam(ssm, "bp_config"))[env];

        const bpToken = await getBpAccessToken();

        const bundle = await getBundle(bpToken, nrAtendimento, cdMpi);

        // const bundle = require("./bundle_test.json"); // Para testes

        // Hash MD5 do bundle
        const crypto = require("crypto");
        const pacote = JSON.stringify(bundle);
        const hash = crypto.createHash("md5").update(pacote).digest("hex");

        console.log(`>>> hash: ${hash} <<<`);

        await pgknex.connect("/Interop/igor_params");

        // Obtém o life_id do membro
        const member = await pgknex.select(
          buildQueryLife(schema, nrCpf, nmPaciente)
        );

        // Confere se já existe o mesmo hash na TAC
        const hash_rep = await pgknex.select(buildQueryHash(hash));

        if (hash_rep.length === 0) {
          hash_rep[0] = { vezes_recebido: 0 };
        }

        pgknex.disconnect();

        const life_id = JSON.parse(JSON.stringify(member[0])).id;

        console.log(`>>> life_id: ${life_id} <<<`);

        //-----------------------------------------------------------------------------------------------
        // Recop Rotina 0
        //-----------------------------------------------------------------------------------------------

        // conecta no DW
        await rds.connect();

        const hash_count = hash_rep[0].vezes_recebido;

        // console.log(`>>> vezes_recebido: ${hash_count} <<<`);

        // Armazena o json cru no S3
        await saveBucket(bundle, nrAtendimento, life_id);

        // Monta o path para o bucket
        const date = new Date();
        const year = date.toISOString().slice(0, 4);
        const month = date.toISOString().slice(5, 7);
        const day = date.toISOString().slice(8, 10);

        const path = `recop/ddp/BP/${year}/${month}/${day}/${aws_request_id}.json`;

        // Monta as informações de envio para a TAC
        const tac = {
          hash: hash,
          id_pacote: aws_request_id,
          arquivo: `s3://sami-data-interoperabilidade/${path}`,
          status: 1,
          editor: "Lambda msImportEpisodeFromBP",
          vezes_recebido: hash_count + 1,
          id_fonte: "BP",
        };

        // Contabilizar na TAC e armazenar na DDP se não existir
        if (hash_count === 0) {
          // Armazena na DDP (nunca foi recebido)
          await recopSaveRaw(bundle, path);

          // Contabiliza na TAC
          await rds.queryCreateTac(tac);
        } else {
          // Atualiza na TAC
          await rds.queryUpdateTac(hash, tac);
        }

        // Disconecta do DW
        rds.disconnect();

        console.log(">>> Conversão FHIR -> OMOP <<<");

        //-----------------------------------------------------------------------------------------------
        //-----------------------------------------------------------------------------------------------

        // Conversão FHIR-OMOP e Persistência no DW
        for (const entry of bundle.entry) {
          const resourceType = `${entry.resource.resourceType}_bp`; // adiciona o "_bp" do mapeamento

          // Os procedures enviados por eles ainda são os nossos e não precisam ser gravados
          if (resourceType !== "Procedure_bp") {
            // console.log(">>><<<");
            // console.log(`>>> FHIR: ${resourceType} <<<`);

            //-----------------------------------------------------------------------------------------------
            // Adicionar o life_id nos recursos necessários (exceto no Practitioner)
            //-----------------------------------------------------------------------------------------------

            var resourceJson = entry.resource;

            resourceJson.care_site_id = "186";

            // adicionar life_id menos no Practitioner
            if (resourceType !== "Practitioner_bp") {
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
            // console.log(`>>> OMOP: ${typeOmop} <<<`);

            //-----------------------------------------------------------------------------------------------

            // console.log(">>> Objeto convertido de FHIR para OMOP <<<");

            // obtém configurações
            const { db_connection } = await getConfig();

            //-------------------------------------------------------------------------------------------------
            // Encontra recursos que já foram gravados antes
            //-------------------------------------------------------------------------------------------------

            if (typeOmop === "care_sites_providers") {
              idType = "id_external";
              id = omopData.main.data.id_external;

              await pgknex.connect("/Interop/igor_params");

              const id_dw = await pgknex.select(
                buildQueryRepetition(schema, typeOmop, idType, id)
              );

              pgknex.disconnect();

              count = JSON.parse(JSON.stringify(id_dw[0])).count;
            } else if (typeOmop === "episodes") {
              // Persistir sempre / vem apenas uma vez e no atendimento específico
              count = "0";
            } else if (
              omopData.main.data.episode_id_external === nrAtendimento
            ) {
              // Persistir apenas se fazer referência ao nrAtendimento do push
              count = "0";
            } else {
              // Recurso recebido anteriormente
              count = "1";
            }

            if (count === "0" || count === 0) {
              // console.log(
              //   `>>> Objeto do tipo ${typeOmop} não existente no DW <<<`
              // );

              // Persistência no DW
              const response = await insertMedicalInfo({
                db_connection,
                db_schema: schema,
                data: omopData,
                resourceType: resourceType.toLowerCase(),
                type: null,
                payload: null,
              });

              // console.log(">>> Armazenado no DW <<<");
            } else {
              // console.log(
              //   `>>> Objeto do tipo ${typeOmop} já existente no DW <<<`
              // );
            }

            // --------------------------------------------------------------------------------------------------
          }
        }
        console.log(">>> Bundle processado com sucesso <<<");
      } else {
        console.log(">>> Atendimento Iniciado <<<");
      }
    }
  } catch (err) {
    // console.log(JSON.stringify(err));
    // sendMessageError("Bundle", nrAtendimento, "modified", err);
    utils.handleError(err);
  }
}

exports.handler = async (event, context) => {
  return await main(event, context);
};
