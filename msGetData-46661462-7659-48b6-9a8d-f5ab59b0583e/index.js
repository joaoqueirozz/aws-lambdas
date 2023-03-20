const databaseOperator = require("databaseOperator");
const {
  assertRequiredValue,
  formatObjectSearch,
  decodeDataResponse,
  handleError,
} = require("utils");
const AwsDynamodb = require("aws-sdk/clients/dynamodb");
const enums = require("./modules/enums/enumerators");

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.warmer) {
    return 0;
  }

  try {
    const { env, id = undefined, entity, db_schema } = event;
    // utils.assertRequiredValue("id", id, "number");
    assertRequiredValue("entity", entity, "string");
    const params = {
      TableName: `Dw_Import_${env}`,
      FilterExpression: "omop_resource = :omop_resource",
      ExpressionAttributeValues: { ":omop_resource": { S: entity } },
    };

    const payload = await formatObjectSearch(
      AwsDynamodb,
      params,
      enums,
      event,
      "get"
    );

    console.log(payload)
    /**
     * Persiste os dados no dw
     */
    const response = await databaseOperator.read({
      entity: entity.toLowerCase(),
      db_schema,
      payload,
    });
    const dataDecoded = await decodeDataResponse(
      AwsDynamodb,
      params,
      enums,
      response,
      "enums"
    );

    if (dataDecoded.length > 1) {
      return dataDecoded;
    }
    return dataDecoded[0];
  } catch (error) {
    handleError(error);
  }
};
