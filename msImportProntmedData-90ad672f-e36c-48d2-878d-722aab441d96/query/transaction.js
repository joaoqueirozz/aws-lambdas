const utils = require("utils.js");

async function execute(env, models, schema, data) {
  let dataRelation = {};

  // Inicia a transação models
  await models.Episode.knex().transaction(async (trx) => {
    try {
      dataRelation["providers"] = data["providers"];
      dataRelation["episodes"] = [data];
      dataRelation["drug_exposures"] = data["drug_exposures"];
      dataRelation["conditions"] = data["conditions"];
      dataRelation["procedures"] = data["procedures"];
      dataRelation["measurements"] = data["measurements"];
      dataRelation["referral"] = data["referral"];
      dataRelation["stage_topic_item"] = data["stage_topic_item"];

      delete data["providers"];
      delete data["drug_exposures"];
      delete data["conditions"];
      delete data["procedures"];
      delete data["measurements"];
      delete data["referral"];
      delete data["stage_topic_item"];

      for (let prop in dataRelation) {
        if (dataRelation[prop]) {
          // Cria dados no DW
          const response = await require(`./episodes`).execute(
            models,
            schema,
            dataRelation[prop],
            prop,
            data,
            trx
          );

          // Atribui o id do Atendimento no data
          if (prop === "episodes") data["episode_id"] = response["id"];
        }
      }

      dataRelation["episode_id"] = data["episode_id"];
      dataRelation["life_id"] = data["life_id"];
    } catch (err) {
      utils.handleError(err);
    }
  });

  return dataRelation;
}

module.exports = {
  execute,
};
