// layers
const lambdaLib = require("aws-sdk/clients/lambda");
const lambda = new lambdaLib();
const pgknex = require("pgknex");
const utils = require("utils.js");
const got = require("got");

// SSM - Parâmetros
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

const bundleRequest = require("./bundleRequest.json");

let env;

//FUNCTION
async function getPatient(identifier, schema) {
  await pgknex.connect("connection_params");

  const patient = await pgknex.select(
    `select l.name, l.gender_source_value, l.birth_at, l.document_identification_primary, l.name_mother, b.health_card_number from ${schema}.lives l, ${schema}.beneficiaries b where b.health_card_number = '${identifier}' and l.id = b.life_id`
  );

  pgknex.disconnect();

  if (!patient || patient.length != 1) {
    throw new Error("patient not found");
  }

  return patient[0];
}

//FUNCTION
async function buildBody(cardNumber, schema) {
  let patient = await getPatient(cardNumber, schema);

  const body = bundleRequest;

  body.name = [
    {
      use: "official",
      text: patient.name,
    },
    {
      use: "usual",
      text: patient.name,
    },
  ];

  body.gender = patient.gender_source_value;
  body.birthDate = patient.birth_at.toISOString().slice(0, 10);

  body.identifier.push(
    {
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "TAX",
          },
        ],
      },
      system: "urn:oid:2.16.840.1.113883.13.237",
      value: patient.document_identification_primary, //TODO confirmar se este é o CPF e o que fazer se não houver
    },
    {
      type: {
        coding: [
          {
            system:
              "http://interop-haoc.com.br/fhir/CodeSystem/HAOCTipoDocumentoIndividuo-1.0",
            code: "SAMI",
          },
        ],
      },
      value: patient.health_card_number, //TODO confirmar com haoc se este valor deve ser enviado aqui
    }
  );

  body.identifier.push({
    url: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRParentesIndividuo-1.0",
    extension: [
      {
        url: "relationship",
        valueCode: "MTH",
      },
      {
        url: "parent",
        valueHumanName: {
          use: "official",
          text: patient.name_mother,
        },
      },
    ],
  });

  return body; // TODO adicionar os demais elementos possíveis
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
      let card = utils.assertRequiredValue("health_card_number", body.health_card_number, "string");
      let consent_status = utils.assertRequiredValue("consent_status", body.consent_status, "string");

      console.log(JSON.stringify(body));
      console.log(`>>> ${resourceType} <<<`);
      console.log(`>>> ${methodType} <<<`);
      console.log(`>>> ${id} <<<`);
      console.log(`>>> ${data.status} <<<`); // undefined quando é Patient
      console.log(`>>> Carteirinha: ${card} <<<`);
      console.log(`>>> Consent Status: ${consent_status} <<<`);

      const haocConfig = (await utils.getSsmParam(ssm, "/Interop/haoc_config"))[
        env
      ];

      console.log(JSON.stringify(haocConfig));

      const bundle = await buildBody(card, schema);

      console.log(JSON.stringify(bundle));

      const url = haocConfig.patientUrl;

      // const url = "https://apimanager-interop.haoc.com.br:8280/mpi/fhir/R4/Patient";
      // const url = "http://apimanager-interop.haoc.com.br:8280/mpi/fhir/Patient";
      // const url = "https://apimanager-interop.haoc.com.br:8243/mpi/fhir/R4/Patient";
      // const url = "https://apimanager-interop.haoc.com.br:8243/mpi/fhir/R4/Patient";

      console.log(`>>> URL: ${url} <<<`);
      console.log(`>>> Token: ${haocConfig.token} <<<`);

      // Para testes:
      // const teste = require("./teste_realizado/patient.json");

      // const result = await got
      //   .post(url, {
      //     headers: {
      //       "Content-Type": "application/fhir+json",
      //       Accept: "application/fhir+json",
      //       Authorization: `Bearer ${haocConfig.token}`,
      //     },
      //     responseType: "json",
      //     body: JSON.stringify(body),
      //   })
      //   .json();

      // console.log(JSON.stringify(result));

      // const message = {
      //   env,
      //   schema,
      //   payload: result,
      // };

      //envia para fila de consentidos haoc
      // await sqs
      //   .sendMessage({
      //     QueueUrl: `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_consent_haoc`,
      //     DelaySeconds: "0",
      //     MessageBody: JSON.stringify(message),
      //   })
      //   .promise();

      // console.log(result);
    }
  } catch (err) {
    utils.handleError(err);
  }
};
