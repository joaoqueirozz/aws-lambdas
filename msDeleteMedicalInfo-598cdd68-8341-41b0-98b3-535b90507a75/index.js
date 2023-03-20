const mapping = require("dataMapping");
const databaseOperator = require("databaseOperator");
const utils = require("utils");

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.warmer) {
    return 0;
  }

  try {
    const { env, data, entity, db_schema } = event;
    utils.assertRequiredValue("data", data, "object");
    utils.assertRequiredValue("entity", entity, "string");

    const payload = await mapping.convertDataMapping(
      env,
      null,
      "Dw",
      entity,
      data,
      [],
      "Import",
      "delete"
    );

    /**
     * Persiste os dados no dw
     */
    const response = await databaseOperator.del({
      entity: entity.toLowerCase(),
      db_schema,
      payload,
    });
    return response;
  } catch (error) {
    // utils.errorLog(error, env);
    utils.handleError(error);
  }
};
