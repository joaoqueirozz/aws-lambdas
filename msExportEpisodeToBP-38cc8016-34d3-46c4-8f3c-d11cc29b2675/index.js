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

    // const result = await got(`${baseUrl}/Encounter/${id}`, {
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: token,
    //   },
    //   responseType: "json",
    // });

    // return result.body;
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
  await pgknex.connectWithParams({
    host: "aqr-sami-rds.cluster-ctxsv2axpjoj.us-east-1.rds.amazonaws.com",
    port: 5432,
    database: "sami_aqr_db",
    user: "root",
    password: "tiVuqe3*FudrLSofeN$=",
  });

  const procedures = await pgknex.select(
    buildQueryProcedures(schema, encounter)
  );

  pgknex.disconnect();

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

  // const conditions = await pgknex.select(
  //   buildQueryConditions(schema, encounter)
  // );

  // // adiciona as conditions
  // for (const condition of conditions) {
  //   console.log("Condition ID:", condition.id);

  //   try {
  //     const resource = await getCondition(token, baseUrl, condition.id);

  //     addEntry(response, {
  //       fullUrl: `${baseUrl}/Condition/${condition.id}`,
  //       resource: resource,
  //     });
  //   } catch (err) {
  //     // throw err;
  //   }
  // }

  // const referrals = await pgknex.select(buildQueryReferrals(schema, encounter));

  // // adiciona as ServiceRequests (referrals)
  // for (const referral of referrals) {
  //   console.log("ServiceRequest ID:", referral.id);

  //   try {
  //     const resource = await getReferral(token, baseUrl, referral.id);

  //     addEntry(response, {
  //       fullUrl: `${baseUrl}/ServiceRequest/${referral.id}`,
  //       resource: resource,
  //     });
  //   } catch (err) {
  //     // throw err;
  //   }
  // }

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

    if (event.identifier) {
      return await buildEncounterBundleByPatient({
        identifier: event.identifier,
        token,
        baseUrl,
        schema,
        env,
      });
    } else if (event.encounter) {
      return await buildEncounterBundleById({
        encounter: event.encounter,
        token,
        baseUrl,
        schema,
        env,
      });
    } else {
      throw utils.buildCustomError(
        400,
        "Pelo menos um dos parâmetros, [identifier] ou [encounter], deve ser informado"
      );
    }
  } catch (err) {
    utils.handleError(err);
  } finally {
    // console.log("Vai desconectar do DW...");
    // pgknex.disconnect();
    // console.log("Desconectou do DW.");
  }
};
