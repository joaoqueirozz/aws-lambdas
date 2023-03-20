const utils = require("utils.js");
const knex = require("knex");
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

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

async function createEpisode(schema, episode) {
  try {
    return await client.transaction(async (trx) => {
      try {
        const episodeId = await client
          .insert(episode, "id")
          .into(`${schema}.episodes`)
          .transacting(trx);

        return episodeId;
      } catch (err) {
        throw err;
      }
    });
  } catch (err) {
    throw err;
  }
}

async function createProcedure(schema, procedure) {
  try {
    return await client.transaction(async (trx) => {
      try {
        const procedureId = await client
          .insert(procedure, "id")
          .into(`${schema}.procedures`)
          .transacting(trx);

        return procedureId;
      } catch (err) {
        throw err;
      }
    });
  } catch (err) {
    throw err;
  }
}

async function createObservation(schema, observation) {
  try {
    return await client.transaction(async (trx) => {
      try {
        const observationId = await client
          .insert(observation, "id")
          .into(`${schema}.observations`)
          .transacting(trx);

        return observationId;
      } catch (err) {
        throw err;
      }
    });
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
  createEpisode,
  createProcedure,
  createObservation,
  queryCreateTac,
  queryUpdateTac,
  disconnect,
};
