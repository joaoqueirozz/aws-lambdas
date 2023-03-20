// DynamoDB
const AwsDynamodb = require("aws-sdk/clients/dynamodb");

const dynamo = new AwsDynamodb();
const converter = AwsDynamodb.Converter;
/**
 * Insert new control searches
 * @param {Object} data required
 * @param {String} env required
 * @returns Object
 */
const insertControl = (data, env) =>
  new Promise((resolve, reject) => {
    const params = {
      TableName: `SurveyControl_${env}`,
      Item: converter.marshall(data),
    };
    dynamo.putItem(params, (err, dataResolved) => {
      if (err) {
        reject(err);
      }
      resolve(dataResolved);
    });
  });

/**
 * Get data SurveyResponse based in id_harmo
 * @param {String} id_harmo required
 * @param {String} member_id required
 * @param {String} env required
 * @returns Object
 */
const getControl = async (env, life_id) =>
  new Promise((resolve, reject) => {
    const params = {
      TableName: `SurveyControl_${env}`,
      Key: {
        id: { N: life_id },
      },
    };
    dynamo.getItem(params, function (err, data) {
      if (err) {
        reject(err);
      } else {
        const values = converter.unmarshall(data.Item);
        resolve(values);
      }
    });
  });
module.exports = { insertControl, getControl };
