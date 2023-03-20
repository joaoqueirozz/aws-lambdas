// Layers
const models = require("models");
let modelStarted = false;

async function connect(connection, schema) {
  models.init(connection, schema);
  modelStarted = true;
}

async function get(patient, id) {
  try {
    let data = await models.Beneficiary.query()
      .where(patient ? "life_id" : "id", id)
      .orderBy("created_at", "desc")
      .withGraphFetched(
        "[companies.[company_locations, company_contacts], lives.[life_locations, life_contacts], contracts.[contracts_health_plans, beneficiaries]]"
      );

    if (data.length > 0) {
      if (data[0] && data[0].holder_id) {
        const beneficiary = await models.Beneficiary.query()
          .where("id", data[0].holder_id)
          .withGraphFetched("lives.[life_locations, life_contacts]")
          .withGraphFetched("contracts");

        data[0]["holder"] = beneficiary[0];
      }

      if (data[0] && data[0].contracts.contract_id) {
        const contract = await models.Contract.query().where(
          "id",
          data[0].contracts.contract_id
        );

        data[0]["contracts"]["fathercontracts"] = contract[0];
      }

      return data[0];
    } else return null;
  } catch (err) {
    throw err;
  }
}

function disconnect() {
  if (modelStarted) models.destroy();
}

module.exports = {
  connect,
  get,
  disconnect,
};
