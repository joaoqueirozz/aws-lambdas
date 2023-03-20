const utils = require("utils.js");
const knex = require("knex");
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();
const dynamo = require("./dynamodb");

let client;

async function getConfig() {
  return new Promise((resolve, reject) => {
    const promises = [];

    // promises.push(utils.getSsmParam(ssm, "connection_params"));
    promises.push(utils.getSsmParam(ssm, "/Interop/igor_params")); // provisório

    Promise.all(promises)
      .then((result) => {
        resolve({
          connection: result[0],
        });
      })
      .catch((err) => {
        reject(err);
      });
  });
}

async function connect() {
  const { connection } = await getConfig();

  client = knex({
    client: "pg",
    connection,
  });
}

async function create(schema, data, externalId, env) {
  try {
    return await client.transaction(async (trx) => {
      try {
        console.log("CRIANDO NA TABELA EPISODES");
        // cria episode
        const episodeIds = await client
          .insert(data.appointment, "id")
          .into(`${schema}.episodes`)
          .transacting(trx);

        const episodeId = episodeIds[0];

        console.log("CRIANDO NA TABELA CONDITIONS");
        // cria conditions
        for (let i = 0; i < data.conditions.length; i++) {
          let condition = data.conditions[i];
          condition.life_id = data.appointment.life_id;
          condition.provider_id_external =
            data.appointment.provider_id_external;
          condition.episode_id = episodeId;
          condition.care_site_id = 1825;
          condition.episode_id_external = data.appointment.id_external;
          condition.stop_at = data.appointment.stop_at;

          await client
            .insert(condition, "id")
            .into(`${schema}.conditions`)
            .transacting(trx);
        }

        // cria measurements
        if (data.measurements && data.measurements.length) {
          console.log("CRIANDO NA TABELA MEASUREMENTS");
          for (let i = 0; i < data.measurements.length; i++) {
            const measurement = data.measurements[i];
            measurement.life_id = data.appointment.life_id;
            measurement.provider_id = data.appointment.provider_id;
            measurement.episode_id = episodeId;
            measurement.care_site_id = 1825;

            await client
              .insert(measurement, "id")
              .into(`${schema}.measurements`)
              .transacting(trx);
          }
        }

        console.log("CRIANDO NA TABELA ENCOUNTER (DYNAMO)");
        // cria na tabela de controle
        await dynamo.updateControl("Encounter", env, episodeId, externalId);

        console.log(`Episode #${episodeId} criado com sucesso`);
      } catch (err) {
        throw err;
      }
    });
  } catch (err) {
    throw err;
  }
}

async function update(schema, entity, data) {
  try {
    return await client.transaction(async (trx) => {
      try {
        await client(`${schema}.${entity}`)
          .where("id", "=", data.id)
          .update(data)
          .transacting(trx);

        console.log(`Episode #${data.id} atualizado com sucesso`);
      } catch (err) {
        throw err;
      }
    });
  } catch (err) {
    throw err;
  }
}

async function getPatientByDocument(schema, document) {
  try {
    let rawQuery = [];
    rawQuery.push("select id ");
    rawQuery.push(`from ${schema}.lives `);
    rawQuery.push(`where document_identification_primary = '${document}'`);
    rawQuery = rawQuery.join("");

    return (await client.raw(rawQuery)).rows[0];
  } catch (err) {
    throw err;
  }
}

async function getPatientByHealthInsuranceNumber(schema, healthCardNumber) {
  try {
    let rawQuery = [];
    rawQuery.push("select life_id as id ");
    rawQuery.push(`from ${schema}.beneficiaries `);
    rawQuery.push(`where health_card_number = '${healthCardNumber}'`);
    rawQuery = rawQuery.join("");

    return (await client.raw(rawQuery)).rows[0];
  } catch (err) {
    throw err;
  }
}

async function getPatientByNameAndBirthDate(schema, name, dateOfBirth) {
  try {
    let rawQuery = [];
    rawQuery.push("select id ");
    rawQuery.push(`from ${schema}.lives `);
    rawQuery.push(`where name = '${name}' and birth_at = '${dateOfBirth}'`);
    rawQuery = rawQuery.join("");

    console.log(rawQuery);

    return (await client.raw(rawQuery)).rows[0];
  } catch (err) {
    throw err;
  }
}

async function getPatientByName(schema, name) {
  try {
    let rawQuery = [];
    rawQuery.push("select id ");
    rawQuery.push(`from ${schema}.lives `);
    rawQuery.push(`where name like '%${name}%'`);
    rawQuery = rawQuery.join("");

    console.log(rawQuery);

    return (await client.raw(rawQuery)).rows[0];
  } catch (err) {
    throw err;
  }
}

async function getProvider(schema, provider) {
  try {
    let rawQuery = [];
    rawQuery.push("select p.id ");
    rawQuery.push(`from ${schema}.providers p `);
    rawQuery.push(
      `where p.national_provider_identification = '${provider.national_provider_identification}'`
    );
    rawQuery = rawQuery.join("");

    let id = null;
    let medic = null;

    medic = (await client.raw(rawQuery)).rows[0];

    if (!medic) {
      id = await createProvider(schema, provider);
    } else {
      id = medic.id;
    }

    return id;
  } catch (err) {
    throw err;
  }
}

async function createProvider(schema, provider) {
  try {
    const ids = await client.insert(provider, "id").into(`${schema}.providers`);

    return ids[0];
  } catch (err) {
    throw err;
  }
}

async function getCareSiteProvider(schema, provider, appointmentId) {
  try {
    let rawQuery = [];
    rawQuery.push("select csp.id ");
    rawQuery.push(`from ${schema}.care_sites_providers csp `);
    rawQuery.push(
      `where csp.national_provider_identification = '${provider.national_provider_identification}' `
    );
    rawQuery.push(`and csp.care_site_id = '1825' `);
    rawQuery = rawQuery.join("");

    medic = (await client.raw(rawQuery)).rows[0];

    if (!medic) {
      const payload = {
        care_site_id: 1825,
        provider_id: null,
        specialty_concept_id: provider.gender_concept_id,
        specialty_synonym_id: provider.gender_synonym_id,
        specialty_source_value: null,
        rank: null,
        gender_source_value: provider.gender_source_value,
        birth_at: null,
        id_external: appointmentId,
        name: provider.name,
        telecom: null,
        npi_type_source_value: null,
        national_provider_identification:
          provider.national_provider_identification,
      };
      id = await createCareSiteProvider(schema, payload);
    } else {
      id = medic.id;
    }

    return id;
  } catch (err) {
    throw err;
  }
}

async function createCareSiteProvider(schema, provider) {
  try {
    const ids = await client
      .insert(provider, "id")
      .into(`${schema}.care_sites_providers`);

    return ids[0];
  } catch (err) {
    throw err;
  }
}

async function queryCreateTac(tac) {
  try {
    return await client.transaction(async (trx) => {
      try {
        console.log(">>> Criando evento na TAC <<<");
        // cria uma linha na TAC
        const tacId = await client
          .insert(tac, "hash")
          .into(`recop.tac`)
          .transacting(trx);
      } catch (err) {
        throw err;
      }
    });
  } catch (err) {
    throw err;
  }
}

async function queryUpdateTac(hash, tac) {
  try {
    return await client.transaction(async (trx) => {
      try {
        console.log(">>> Pacote já recebido anteriormente <<<");
        await client(`recop.tac`)
          .where("hash", "=", hash)
          .update(tac)
          .transacting(trx);
      } catch (err) {
        throw err;
      }
    });
  } catch (err) {
    throw err;
  }
}

function disconnect() {
  if (client) {
    client.destroy();
  }
}

module.exports = {
  connect,
  create,
  update,
  getPatientByDocument,
  getPatientByHealthInsuranceNumber,
  getPatientByNameAndBirthDate,
  getPatientByName,
  getProvider,
  getCareSiteProvider,
  queryCreateTac,
  queryUpdateTac,
  disconnect,
};
