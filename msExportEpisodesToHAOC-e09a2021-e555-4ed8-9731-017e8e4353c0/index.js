// layers
const lambdaLib = require("aws-sdk/clients/lambda");
const lambda = new lambdaLib();

const utils = require("utils.js");
const got = require("got");
const { v4: uuidv4 } = require("uuid");

//FUNCTION
function generateGUID() {
  return uuidv4();
}

//FUNCTION
async function getPatient(token, baseUrl, cardNumber) {
  try {
    const result = await got(`${baseUrl}/Patient`, {
      searchParams: {
        identifier: `./NamingSystem/cartao_plano_saude/${cardNumber}`,
      },
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      responseType: "json",
    });

    return result.body;
  } catch (err) {
    if (err.response.statusCode === 404) {
      return null;
    }

    console.log(err);
    throw utils.buildCustomError(
      500,
      "Erro buscando o paciente na API ESBSamihealth"
    );
  }
}

//FUNCTION
async function getPatientById(token, baseUrl, id) {
  try {
    const result = await got(`${baseUrl}/Patient/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      responseType: "json",
    });

    return result.body;
  } catch (err) {
    if (err.response.statusCode === 404) {
      return null;
    }

    console.log(err);
    throw utils.buildCustomError(
      500,
      "Erro buscando o paciente na API ESBSamihealth"
    );
  }
}

//FUNCTION
async function getEpisode(env, schema, token, baseUrl, id) {
  try {
    return await utils.invokeLambda(lambda, `msGetMedicalInfo:${env}`, {
      resourceType: "Encounter",
      id,
      base_url: baseUrl,
      db_schema: schema,
      env,
    });

  } catch (err) {
    if (err.response.statusCode === 404) {
      return null;
    }

    console.log(err);
    throw utils.buildCustomError(
      500,
      "Erro buscando o atendimento na API ESBSamihealth"
    );
  }
}

//FUNCTION
async function getProcedure(token, baseUrl, id) {
  try {
    const result = await got(`${baseUrl}/Procedure/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      responseType: "json",
    });

    return result.body;
  } catch (err) {
    throw err;
  }
}

//FUNCTION
async function getCondition(token, baseUrl, id) {
  try {
    const result = await got(`${baseUrl}/Condition/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      responseType: "json",
    });

    return result.body;
  } catch (err) {
    throw err;
  }
}

//FUNCTION
async function getReferral(token, baseUrl, id) {
  try {
    const result = await got(`${baseUrl}/ServiceRequest/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      responseType: "json",
    });

    return result.body;
  } catch (err) {
    throw err;
  }
}

//FUNCTION
function buildQueryEpisodes(schema, patientId) {
  const query = [];
  query.push(`SELECT e.id FROM ${schema}.episodes e `);
  query.push(`WHERE e.life_id = ${patientId}`);
  return query.join("");
}

//FUNCTION
function buildQueryProcedures(schema, episodeId) {
  const query = [];
  query.push(`SELECT p.id, p.provider_id FROM ${schema}.procedures p `);
  query.push(`WHERE p.episode_id = ${episodeId}`);

  return query.join("");
}

//FUNCTION
function buildQueryConditions(schema, episodeId) {
  const query = [];
  query.push(`SELECT p.id, p.provider_id FROM ${schema}.conditions p `);
  query.push(`WHERE p.episode_id = ${episodeId}`);

  return query.join("");
}

//FUNCTION
function buildQueryReferrals(schema, episodeId) {
  const query = [];
  query.push(`SELECT p.id, p.provider_id FROM ${schema}.referral p `);
  query.push(`WHERE p.episode_id = ${episodeId}`);

  return query.join("");
}

//FUNCTION
function buildBundle(path, baseUrl, entries) {
  return {
    resourceType: "Bundle",
    id: generateGUID(),
    type: "searchset",
    total: 1,
    link: [
      {
        relation: "self",
        url: `${baseUrl}${path}`,
      },
    ],
    entry: entries,
  };
}

//FUNCTION
function addEntry(bundle, entry) {
  bundle.entry.push(entry);
  bundle.total += 1;
}

//FUNCTION
function buildEmptyBundle(path, baseUrl) {
  const response = buildBundle(path, baseUrl, []);
  response.total = 0;
  return response;
}

//FUNCTION
function validateIdentifierParam(identifier) {
  const splitted = identifier.split("/");

  if (splitted.length !== 4) {
    throw utils.buildCustomError(
      400,
      "Erro de formato no parâmetro [identifier]: namespace inválido"
    );
  }

  const cardNumber = splitted.pop();
  if (cardNumber.length === 0) {
    throw utils.buildCustomError(
      400,
      "Erro de formato no parâmetro [identifier]: número da carteirinha não informado"
    );
  }

  const namespace = splitted.join("/");

  if (namespace !== "./NamingSystem/cartao_plano_saude") {
    throw utils.buildCustomError(
      400,
      "Erro de formato no parâmetro [identifier]: namespace inválido"
    );
  }

  return cardNumber;
}

//FUNCTION
function validateEncounterParam(encounter) {
  if (isNaN(encounter)) {
    throw utils.buildCustomError(
      400,
      "Erro de formato no parâmetro [encounter]: deve conter apenas dígitos"
    );
  }
}



//FUNCTION
async function buildEncounterBundleById(params) {
  const { encounter, baseUrl, token, schema, patient, env } = params;

  validateEncounterParam(encounter);

  const response = buildEmptyBundle(`/v2?encounter=${encounter}`, baseUrl);

  const episode = await getEpisode(env, schema, token, baseUrl, encounter);

  if (!episode) {
    return response;
  }

  let fhirPatient = patient;
  if (!fhirPatient) {
    fhirPatient = await getPatientById(
      token,
      baseUrl,
      episode.subject.reference.split("/").pop()
    );

    if (!fhirPatient) {
      return response;
    }
  }

  addEntry(response, {
    fullUrl: `${baseUrl}/Patient/${fhirPatient.id}`,
    resource: fhirPatient,
  });

  addEntry(response, {
    fullUrl: `${baseUrl}/Encounter/${encounter}`,
    resource: episode,
  });

  const pgknex = require("pgknex");

  // conecta no DW
  await pgknex.connectWithParams({  //TODO usar ssm config
    host: "aqr-sami-rds.cluster-ctxsv2axpjoj.us-east-1.rds.amazonaws.com",
    port: 5432,
    database: "sami_aqr_db",
    user: "root",
    password: "tiVuqe3*FudrLSofeN$=",
  });

  const procedures = await pgknex.select(
    buildQueryProcedures(schema, encounter)
  );

  // adiciona os procedimentos
  for (const procedure of procedures) {
    try {
      const resource = await getProcedure(token, baseUrl, procedure.id);

      addEntry(response, {
        fullUrl: `${baseUrl}/Procedure/${procedure.id}`,
        resource: resource,
      });
    } catch (err) {
      // throw err;
    }
  }

  pgknex.disconnect();

  return response;
}

//FUNCTION
async function buildEncounterBundleByPatient(params) {
  const { identifier, token, baseUrl, schema, env } = params;

  const cardNumber = validateIdentifierParam(identifier);

  const response = buildEmptyBundle(
    `/v2?identifier=./NamingSystem/cartao_plano_saude/${cardNumber}`,
    baseUrl
  );

  // obtém o Patient em FHIR
  const patient = await getPatient(token, baseUrl, cardNumber);

  if (!patient) {
    return response;
  }

  // obtém os atendimentos do DW
  const episodes = await pgknex.select(buildQueryEpisodes(schema, patient.id));

  if (!episodes || episodes.length === 0) {
    return response;
  }

  // adiciona os encounters
  for (const episode of episodes) {
    addEntry(
      response,
      await buildEncounterBundleById({
        encounter: episode.id,
        token,
        baseUrl,
        schema,
        patient,
        env,
      })
    );
  }

  return response;
}


//FUNCTION
async function getOneTrustToken(){

  var formdata = new FormData();
  formdata.append("grant_type", "client_credentials");
  formdata.append("client_id", "17688ec70aea4e179598dfae9a8b4d18");
  formdata.append("client_secret", "e1i3cNOX1BFW2NvAic14VcWULVH3f9Po");

  const body  = await got.post("https://app-br.onetrust.com/api/access/v1/oauth/token", {
      headers: formdata.getHeaders(),
      body: formdata
  }).json();

  if (!body || !body.access_token){
    throw new Error('One trust access token not found');
  }

  return body.access_token
}


//FUNCTION
async function checkConsent(identifier){
   const token = await getOneTrustToken()

   const body  = await got.get("https://app-br.onetrust.com/api/access/v1/oauth/https://app-br.onetrust.com/api/consentmanager/v1/datasubjects/profiles?purposeGuid=93524917-5c4b-4507-a50b-16262cb6df83", {
    headers: {
      ContentType: "application/json",
      identifier,
      Authorization: `Bearer ${token}`
    }
  }).json();


  return body
    && body.content
    && body.content[0].Purposes
    && body.content[0].Purposes[0].Status === 'ACTIVE'
}

//FUNCTION
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const env = utils.assertRequiredValue("env", event.env, "string");
    const baseUrl = utils.assertRequiredValue(
      "baseUrl",
      event.base_url,
      "string"
    );
    const schema = utils.assertRequiredValue(
      "schema",
      event.db_schema,
      "string"
    );
    const token = utils.assertRequiredValue(
      "token",
      event.access_token,
      "string"
    );
    const identifier = utils.assertRequiredValue(
      "identifier",
      event.identifier,
      "string"
    );

    const consent = await checkConsent(identifier)

    if (!consent){
      throw new Error(`Concentimento Negado por ${identifier}`)
    }

    return await buildEncounterBundleByPatient({
      identifier,
      token,
      baseUrl,
      schema,
      env,
    });

  } catch (err) {
    utils.handleError(err);
  }
};
