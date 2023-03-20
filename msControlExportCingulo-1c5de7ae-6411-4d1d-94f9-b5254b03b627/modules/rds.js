const utils = require("utils.js");
const knex = require("knex");
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

let client;

async function getConfig() {
  return new Promise((resolve, reject) => {
    const promises = [];

    promises.push(utils.getSsmParam(ssm, "/Interop/igor_params"));

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

async function sendControl(record) {
  try {
    return await client.transaction(async (trx) => {
      try {
        const controlId = await client
          .insert(record, "id")
          .into(`sandbox.base_cingulo`)
          .transacting(trx);

        return controlId;
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
  sendControl,
  disconnect,
};
