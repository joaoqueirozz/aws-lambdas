const utils = require("utils");

async function execute(models, event) {
  try {
    return await models.CareSiteProvider.knex().transaction(async (trx) => {
      try {
        event.data.main.data.id = (
          await models.CareSiteProvider.knex()
            .insert(event.data.main.data, "id")
            .into(`${event.db_schema}.care_sites_providers`)
            .transacting(trx)
        )[0];

        return event.data.main.data;
      } catch (err) {
        throw err;
      }
    });
  } catch (err) {
    throw utils.buildCustomError(400, err.detail || err.message);
  } finally {
    models.destroy();
  }
}

module.exports = {
  execute,
};
