//Utils
const {
  assertRequiredValue,
  formatObjectEnums,
  handleError,
  getSsmParam,
  infoLog,
} = require("utils");

//DataBase Operator
const databaseOperator = require("databaseOperator");

//Dynamo
const enums = require("./modules/enums/enumerators");
const AwsDynamodb = require("aws-sdk/clients/dynamodb");

//SSM
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

//Queue
const { dispatchMessage } = require("./modules/queues/queue");

//Redis
const redisCache = require("redis-cache");

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.warmer) {
    return 0;
  }

  try {
    const { env, entity, db_schema, id, data } = event;

    assertRequiredValue("data", data, "object");
    assertRequiredValue("id", id, "number");
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

    payload.id = id;

    /**
     * Persiste os dados no dw
     */
    const response = await databaseOperator.update({
      entity: entity.toLowerCase(),
      db_schema,
      payload,
    });

    // Remove Cache Radis
    const cacheConfig = await getSsmParam(ssm, "cache_config");
    await redisCache.clearCache(cacheConfig[env]);

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
      methodType: "update",
    };

    infoLog(payloadQueue, env);

    //dispatch message to other queues
    const message = await dispatchMessage(payloadQueue, env, entity);
    console.log(`${JSON.stringify(message)}`);

    return response;
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
