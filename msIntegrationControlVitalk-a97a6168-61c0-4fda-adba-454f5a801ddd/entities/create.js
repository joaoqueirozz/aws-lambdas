const { insertControl } = require("../modules/dynamo/control");

/**
 * Create items in database survey_conduct and survey_response
 * @param {Objecy} models required
 * @param {String} env required
 * @param {Object} exists required
 * @param {Object} conduct required
 * @param {String} database required
 * @param {Object} response required
 */
async function executeCreateConduct(
  models,
  env,
  database,
  conduct,
  response,
  exists
) {
  if (!exists.conduct_id) {
    const trx = await models.SurveyConduct.knex().transaction();
    await trx(`${database}.survey_conducts`)
      .insert(conduct, "id")
      .then(async (ids) => {
        const link_id = new Date().getTime();
        response.episode_survey_conduct_id = Number(ids[0]);
        response.link_id = link_id;

        await trx(`${database}.survey_responses`).insert(response);

        const created = new Date().toISOString();
        await insertControl(
          {
            created,
            conduct_id: Number(ids[0]),
            id: Number(conduct.life_id),
          },
          env
        );
      })
      .then(() => {
        trx.commit();
      })
      .catch((error) => {
        trx.rollback();
        throw error;
      });
  } else {
    const { conduct_id } = exists;
    const trn = await models.SurveyResponse.knex().transaction();
    const link_id = new Date().getTime();
    response.episode_survey_conduct_id = conduct_id;
    response.link_id = link_id;

    await trn(`${database}.survey_responses`)
      .insert(response, "id")
      .then((ids) => ids)
      .then(() => {
        trn.commit();
      })
      .catch((error) => {
        trn.rollback();
        throw error;
      });
  }
}

module.exports = {
  executeCreateConduct,
};
