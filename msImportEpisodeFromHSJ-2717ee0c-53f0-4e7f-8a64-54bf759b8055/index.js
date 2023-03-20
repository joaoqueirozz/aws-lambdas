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

let hsjConfig;

let idType;
let id;
let count;

async function getHsjAccessToken() {
  try {
    const {
      AUTH_URL: authUrl,
      AUTH_TYPE: authType,
      CLIENT_ID: clientId,
      CLIENT_SECRET: clientSecret,
    } = hsjConfig;

    console.log(hsjConfig); // provisório

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

async function getBundle(token, id) {
  try {
    const { BASE_URL: baseUrl, BUNDLE_QUERYSTRING: bundleQuerystring } =
      hsjConfig;

    const result = await got(
      `${baseUrl}${bundleQuerystring.replace("##id##", id)}`,
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

async function saveBucket(bundle, id) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: `hsj/${id}_${new Date().getTime()}.json`,
        ContentType: "application/json",
        Body: JSON.stringify(bundle),
      })
      .promise();

    console.log(">>> Armazenado no s3://sami-data-interoperabilidade/hsj/ <<<");
  } catch (err) {
    throw err;
  }
}

function buildQueryLife(schema, patient) {
  const query = [];

  query.push(
    `select id from ${schema}.lives l where document_identification_primary = '${patient}' ` // e se não tiver CPF?
  );

  return query.join("");
}

async function main(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }

    console.log(">>> Event <<<");

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

      const baseUrl = utils.assertRequiredValue(
        "base_url",
        body.base_url,
        "string"
      );

      const { idBundle, nrCpf, ieTipoMsg } = utils.assertRequiredValue(
        "body.payload",
        body.payload.payload,
        "object"
      );

      console.log(`>>> idBundle: ${idBundle} <<<`);
      console.log(`>>> CPF: ${nrCpf} <<<`);
      console.log(`>>> Tipo de Push: ${ieTipoMsg} <<<`);

      hsjConfig = (await utils.getSsmParam(ssm, "/Interop/hsj_config"))[env];

      const hsjToken = await getHsjAccessToken();

      console.log(hsjToken);

      const bundle = await getBundle(hsjToken, idBundle);

      // const bundle_test = require("./bundle_test.json");

      // Mensagem do tipo 2 representa fim de um atendimento
      if (ieTipoMsg === 2) {
        console.log(">>> O atendimento do membro no HSJ foi finalizado <<<");

        // Provisório
        await saveBucket(bundle, idBundle);

        // await pgknex.connect("connection_params");

        // // Obtém o life_id do membro
        // const member = await pgknex.select(buildQueryLife(schema, nrCpf));

        // pgknex.disconnect();

        // // console.log(member);

        // const life_id = JSON.parse(JSON.stringify(member[0])).id;

        // console.log(`>>> life_id no DW: ${life_id} <<<`);

        console.log(">>> Bundle processado com sucesso <<<");
      } else {
        console.log(">>> Início de atendimento <<<");
      }
    }
  } catch (err) {
    utils.handleError(err);
  }
}

exports.handler = async (event, context) => {
  return await main(event, context);
};
