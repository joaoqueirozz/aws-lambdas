const databaseOperator = require("databaseOperator");
const utils = require("utils");

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.warmer) {
    return 0;
  }

  try {
    const { id, entity, db_schema } = event;
    utils.assertRequiredValue("id", id, "number");
    utils.assertRequiredValue("entity", entity, "string");

    const payload = { id };

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
    utils.handleError(error);
  }
};
