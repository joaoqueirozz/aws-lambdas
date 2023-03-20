// DynamoDB
const AwsDynamodb = require("aws-sdk/clients/dynamodb");

const dynamo = new AwsDynamodb();
const converter = AwsDynamodb.Converter;

module.exports = {
  /**
   * Verify if contain id in table
   * @param {String} resourceType required
   * @param {Int} id requires
   * @returns Data of null
   */
  async getControlTable(resourceType, id, env) {
    try {
      const params = {
        TableName: `${resourceType}Control_Export_${env}`,
        KeyConditionExpression: "id = :id and integration = :integration",
        ExpressionAttributeValues: {
          ":id": { N: id.toString() },
          ":integration": { S: "Hubspot" },
        },
      };

      const data = await dynamo.query(params).promise();

      return data.Items && data.Items.length > 0
        ? converter.unmarshall(data.Items[0])
        : null;
    } catch (err) {
      throw err;
    }
  },
  /**
   * Insert data in control table
   * @param {String} resourceType required
   * @param {Int} id required
   * @param {int} idExternal requires
   * @param {String} created requires
   * @returns Message success or error
   */
  async insertControlTable(resourceType, id, idExternal, created, env) {
    try {
      let data = {
        id: Number(id),
        id_external: idExternal.toString(),
        integration: "Hubspot",
        created,
      };

      const params = {
        Item: converter.marshall(data),
        TableName: `${resourceType}Control_Export_${env}`,
      };

      await dynamo.putItem(params).promise();
      return { message: "Inserted with success" };
    } catch (err) {
      throw err;
    }
  },
};
