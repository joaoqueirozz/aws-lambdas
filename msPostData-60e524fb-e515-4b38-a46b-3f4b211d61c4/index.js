const {
  assertRequiredValue,
  formatObjectEnums,
  handleError,
  infoLog,
} = require("utils");

//DataBase Operator
const databaseOperator = require("databaseOperator");

//Queue
const { dispatchMessage } = require("./modules/queues/queue");

//Dynamo
const enums = require("./modules/enums/enumerators");
const AwsDynamodb = require("aws-sdk/clients/dynamodb");

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.warmer) {
    return 0;
  }

  try {
    const { env, data, entity, db_schema } = event;
    assertRequiredValue("data", data, "object");
    assertRequiredValue("entity", entity, "string");

    const params = {
      TableName: `Dw_Import_${env}`,
      FilterExpression: "omop_resource = :omop_resource",
      ExpressionAttributeValues: { ":omop_resource": { S: entity } },
    };

    await databaseOperator.validate(entity, data);
    const payload = await formatObjectEnums(
      AwsDynamodb,
      params,
      enums,
      data,
      "enums"
    );

    /**
     * Persiste os dados no dw
     */
    const response = await databaseOperator.insert({
      entity: entity.toLowerCase(),
      db_schema,
      payload,
    });

    const id =
      response && response.length > 0
        ? response[0].id
        : response
        ? response.id
        : null;
    const resourceType = getResource(entity);

    const schema = env != "prd" ? `datawarehouse_${env}` : `datawarehouse`;

    const payloadQueue = {
      env,
      base_url:
        "https://n9im7t03ha.execute-api.us-east-1.amazonaws.com/production/fhir",
      schema,
      resourceType,
      id,
      type: "",
      modified: new Date().toISOString(),
      messageId: `message-${resourceType.toLowerCase()}-${id}-${new Date().getTime()}`,
      groupId: `${env}-${resourceType}-${id}`,
      methodType: "create",
    };

    infoLog(payloadQueue, env);

    const message = await dispatchMessage(payloadQueue, env, entity);
    console.log(`${JSON.stringify(message)}`);

    if (response.length > 1) {
      return response;
    }
    return response[0];
  } catch (error) {
    handleError(error);
  }
};

function getResource(entity) {
  const propTypes = {
    companies: "Organization",
    company_contacts: "Organization",
    company_locations: "Organization",
    contracts: "Contract",
    contracts_health_plans: "Contract",
    lives: "Patient",
    life_contacts: "Patient",
    life_locations: "Patient",
    beneficiaries: "Coverage",
  };

  return propTypes[entity];
}
