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
};
