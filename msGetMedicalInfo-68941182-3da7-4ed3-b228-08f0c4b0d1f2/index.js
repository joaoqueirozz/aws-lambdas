const fhirOmopConverter = require("fhir-omop-converter");
const models = require("models");
const redisCache = require("redis-cache");
const utils = require("utils");

const crypto = require("crypto");
const path = require("path");
const _ = require("lodash");

const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();
const awsS3 = require("aws-sdk/clients/s3");
const s3 = new awsS3();
const kmsLib = require("aws-sdk/clients/kms");
const kms = new kmsLib();

let env;

function getConfig() {
  return {
    db_connection: {
      host: "aqr-sami-rds.cluster-ctxsv2axpjoj.us-east-1.rds.amazonaws.com",
      port: 5432,
      database: "sami_aqr_db",
      user: "root",
      password: "tiVuqe3*FudrLSofeN$=",
    },
    tablenames: {
      patient: "lives",
      basicgrace: "grace_types",
      basicprice: "health_plan_costs",
      bundleprice: "health_plan_costs",
      organizationpay: "companies",
      organizationins: "health_insurances",
      insuranceplan: "health_plans",
      healthplan: "health_plans",
      coverage: "beneficiaries",
      contract: "contracts",
      company: "companies",
      practitioner: "providers",
      healthcareservice: "care_sites",
      practitionerrole: "care_sites_providers",
      questionnaireresponse: "survey_conducts",
      careteam: "care_teams",
      groupperson: "care_team_lives",
      groupsite: "health_plan_care_sites",
      procedure: "procedures",
      careplan: "care_plans",
      condition: "conditions",
      encounter: "episodes",
      medicationstatement: "drug_exposures",
      observation: "measurements",
      device: "device_exposures",
      paymentnotice: "payments",
      servicerequest: "referral",
    },
    bucketPhoto: {
      bucket: "sami-iota-health-insurance-contracts-and-documents",
      folder: "beneficiary-documents",
      fileTypes: ["profile", "cpf", "doc_uniao", "rg", "cnh", "contract"],
    },
    cacheConfig: {
      dev: {
        url: "redis://aqr-epsilon-etl-cache.qlpci5.0001.use1.cache.amazonaws.com:6379",
        db: 3,
        ttl: 3600,
      },
      hml: {
        url: "redis://aqr-epsilon-etl-cache.qlpci5.0001.use1.cache.amazonaws.com:6379",
        db: 4,
        ttl: 3600,
      },
      prd: {
        url: "redis://aqr-epsilon-etl-cache.qlpci5.0001.use1.cache.amazonaws.com:6379",
        db: 5,
        ttl: 3600,
      },
    },
    beneficiaryDocs: {
      bucket: "sami-iota-health-insurance-contracts-and-documents",
      folders: ["beneficiary-documents", "hirer-documents"],
      fileTypes: [
        "profile",
        "cpf",
        "doc_uniao",
        "rg",
        "cnh",
        "contrato_assinado",
        "declaracao_saude_assinado",
      ],
    },
  };
}

// async function getConfig() {
//     return new Promise((resolve, reject) => {
//         const promises = [];

//         promises.push(utils.getSsmParam(ssm, 'connection_params'));
//         promises.push(utils.getSsmParam(ssm, 'tablenames'));
//         promises.push(utils.getSsmParam(ssm, 'beneficiary_photo_config'));
//         promises.push(utils.getSsmParam(ssm, 'cache_config'));
//         promises.push(utils.getSsmParam(ssm, 'beneficiary_documents'));

//         Promise.all(promises)
//             .then(result => {
//                 resolve({
//                     db_connection: result[0],
//                     tablenames: result[1],
//                     bucketPhoto: result[2],
//                     cacheConfig: result[3],
//                     beneficiaryDocs: result[4],
//                 });
//             })
//             .catch(err => {
//                 utils.errorLog(err);
//                 reject(err);
//             });
//     });
// }

function getStage(env) {
  switch (env) {
    case "dev": {
      return "development";
    }
    case "hml": {
      return "staging";
    }
    case "prd": {
      return "production";
    }
  }
}

async function allBucketKeys(config, appid) {
  const files = [];
  for (let i = 0; i < config.folders.length; i++) {
    const params = {
      Bucket: config.bucket,
      Prefix: `${config.folders[i]}/${getStage(env)}/${appid}`,
    };
    for (;;) {
      const data = await s3.listObjects(params).promise();
      data.Contents.forEach((elem) => {
        const elemKey = elem.Key.toLowerCase();
        config.fileTypes.forEach((type) => {
          if (elemKey.includes(`${type}.`)) {
            const url = s3.getSignedUrl("getObject", {
              Bucket: `${params.Bucket}/${params.Prefix}`,
              Key: `${type}${path.extname(elemKey)}`,
              Expires: 86400, // 1 dia
            });
            files.push({
              omop: `picture_${type}_url`,
              url,
            });
          }
        });
      });
      if (!data.IsTruncated) {
        break;
      }
      params.Marker = data.NextMarker;
    }
  }
  return files;
}

async function getMedicalInfo(resourceType, params, config) {
  // executa operação na base de dados

  const data = await executeDatabaseOperation(
    resourceType,
    config.db_connection,
    params
  );

  if (resourceType === "structuredefinition" || resourceType === "valueset") {
    return data;
  }

  let entityName;
  if (resourceType === "organization" || resourceType === "group") {
    entityName =
      config.tablenames[`${resourceType}${params.type.toLowerCase()}`];
  } else if (resourceType === "basic") {
    const checkedType =
      params.basicType && params.basicType.length > 0
        ? params.basicType.toLowerCase()
        : "grace";
    entityName = config.tablenames[`${resourceType}${checkedType}`];
  } else if (resourceType === "bundle") {
    entityName =
      config.tablenames[`${resourceType}${params.basicType.toLowerCase()}`];
  } else {
    entityName = config.tablenames[resourceType];
  }

  if (data.length >= 0) {
    const response = {
      resourceType: "Bundle",
      type: "searchset",
      total: data.length,
      entry: [],
    };

    for (let i = 0; i < data.length; i++) {
      if (data[i].health_plan_id) {
        delete data[i].health_plan_id;
      }

      if (data[i].primary_health_provider_id) {
        delete data[i].primary_health_provider_id;
      }

      if (data[i].primary_health_care_site_id) {
        delete data[i].primary_health_care_site_id;
      }

      if (data[i].patient_app_id) {
        const images = await allBucketKeys(
          config.beneficiaryDocs,
          data[i].patient_app_id
        );

        for (let j = 0; j < images.length; j++) {
          if (images[j]) {
            data[i][images[j].omop] = images[j].url;
          }
        }
      }

      response.entry.push({
        resource: await fhirOmopConverter.omopToFhir(
          env,
          data[i],
          entityName,
          params.base_url
        ),
      });
    }

    return response;
  }

  if (data.primary_health_provider_id) {
    delete data.primary_health_provider_id;
  }

  if (data.primary_health_care_site_id) {
    delete data.primary_health_care_site_id;
  }

  if (data.patient_app_id) {
    const images = await allBucketKeys(
      config.beneficiaryDocs,
      data.patient_app_id
    );

    for (let j = 0; j < images.length; j++) {
      if (images[j]) {
        data[images[j].omop] = images[j].url;
      }
    }
  }

  const res = await fhirOmopConverter.omopToFhir(
    env,
    data,
    entityName,
    params.base_url
  );

  return res;
}

function mergeOptions(dest, src) {
  // se o objeto origem é null ou undefined
  if (_.isNil(src)) {
    return dest;
  }

  // se o objeto destino é null ou undefined
  if (_.isNil(dest)) {
    return src;
  }

  // se o objeto origem é do tipo Array
  if (_.isArray(src)) {
    // percorre o array e faz o merge recursivo de cada item
    for (let i = 0; i < src.length; i++) {
      dest[i] = mergeOptions(dest[i], src[i]);
    }

    return dest;
  }

  // se o objeto origem é do tipo Object
  if (_.isObject(src)) {
    // percorre os atributos e faz o merge recursivo de cada um
    for (let prop in src) {
      dest[prop] = mergeOptions(dest[prop], src[prop]);
    }

    return dest;
  }

  return src;
}

function getQueryParams(params) {
  if (params.holder)
    return {
      holder_id: params.holder,
    };

  if (params.beneficiary)
    return {
      beneficiary_id: params.beneficiary,
    };

  if (params.healthcareservice)
    return {
      healthcareservice_id: params.healthcareservice,
    };
}

async function executeDatabaseOperation(resourceType, db_connection, params) {
  try {
    models.init(db_connection, params.db_schema);
    return await require(`./entities/${resourceType}`).execute(
      params.id,
      models,
      utils,
      mergeOptions,
      _,
      params.type,
      params.identifier,
      params.db_schema,
      params.page,
      params.size,
      getQueryParams(params),
      params.basicType,
      params.costGroup
    );
  } catch (err) {
    utils.errorLog(err, env);
    throw err;
  } finally {
    models.destroy();
  }
}

function buildResourceCacheName(event) {
  if (event.type && event.type.length > 0) {
    return `${event.resourceType}_${event.type}`;
  }

  if (event.basicType && event.basicType.length > 0) {
    return `${event.resourceType}_${event.basicType}`;
  }

  return event.resourceType;
}

async function main() {
  return new Promise((resolve, reject) => {
    resolve({
      id: 1500,
      name: [
        {
          use: "official",
          text: "Arthur Apolinário Abate",
        },
      ],
      extension: [
        {
          valueString: "Priscila Apolinário",
          url: "./StructureDefinition/patient-mothersMaidenName",
        },
        {
          valueDateTime: "2015-01-29T00:00:00.000Z",
          url: "./StructureDefinition/patient-birthTime",
        },
        {
          valueCodeableConcept: {
            coding: [
              {
                code: "unknown",
                system: "race",
                display: "Desconhecido",
              },
            ],
          },
          url: "./StructureDefinition/patient-race",
        },
        {
          valueCode: "unknown",
          url: "./StructureDefinition/patient-scholarity",
        },
        {
          extension: [
            {
              valueCodeableConcept: {
                coding: [
                  {
                    code: "unknown",
                    system: "nationality",
                    display: "Desconhecido",
                  },
                ],
              },
              url: "code",
            },
          ],
          url: "./StructureDefinition/patient-nationality",
        },
      ],
      gender: "male",
      maritalStatus: {
        coding: [
          {
            system: "./ValueSet/marital-status",
            code: "unknown",
            display: "Desconhecido",
          },
        ],
      },
      identifier: [
        {
          value: "34",
          system: "./NamingSystem/cartao_plano_saude",
        },
      ],
      link: [
        {
          type: "refer",
          other: {
            reference:
              "https://v51z3whrql.execute-api.us-east-1.amazonaws.com/development/fhir/Patient/480",
            type: "Patient",
          },
        },
      ],
      resourceType: "Patient",
    });
  });
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log(event)
  env = event.env;

  if (event.warmer) {
    return 0;
  }

  try {
    let params = event;
    const resourceType =
      event.resourceType && event.resourceType.length > 0
        ? event.resourceType
        : "Bundle";
    params.type = params.type ? params.type : params.type_;

    // obtém configurações
    const config = getConfig();

    let response;

    const resourceCacheName = buildResourceCacheName(event);

    if (!params.history) {
      response = await redisCache.getCache(
        resourceCacheName,
        config.cacheConfig[env],
        params.id,
        params.identifier
      );

      if (response) {
        return JSON.parse(response);
      }
    }

    // lê o objeto do DW
    response = await getMedicalInfo(resourceType.toLowerCase(), params, config);

    if (resourceType === "StructureDefinition" || resourceType === "ValueSet") {
      if (!params.history) {
        await redisCache.setCache(
          resourceCacheName,
          config.cacheConfig[env],
          params.id,
          params.identifier,
          response
        );
      }

      return response;
    }

    if (params.usecrypto && params.usecrypto === "1") {
      // encripta a resposta
      const { encryptedKey, encryptedData } = await utils.encryptData(
        kms,
        crypto,
        JSON.stringify(response)
      );

      // retorna
      response = {
        encryptedKey: encryptedKey.toString("base64"),
        encryptedData,
      };
    }

    if (response.resourceType === "Bundle") {
      for (let i = 0; i < response.entry.length; i++) {
        response.entry[i].resource.id = parseInt(
          response.entry[i].resource.id,
          10
        );
      }
    } else {
      response.id = parseInt(response.id, 10);
    }

    if (!params.history) {
      await redisCache.setCache(
        resourceCacheName,
        config.cacheConfig[env],
        params.id,
        params.identifier,
        response
      );
    }

    // retorna
    return response;
  } catch (err) {
    utils.errorLog(err, env);
    utils.handleError(err);
  }
};
