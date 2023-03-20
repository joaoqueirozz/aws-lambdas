// SQS
const awsSQS = require("aws-sdk/clients/sqs");
const sqs = new awsSQS();

const utils = require("utils.js");

async function pushMessageToQueue(params) {
  try {
    return await sqs
      .sendMessage({
        QueueUrl: `https://sqs.us-east-1.amazonaws.com/707583345549/${params.env}_export_isalab`,
        MessageBody: JSON.stringify(params),
      })
      .promise();
  } catch (err) {
    throw err;
  }
}
/**
 * Send message to queue hubspot
 * @param {Object} data required
 * @param {String} env required
 */
async function sendMessageToQueue(data, env) {
  if (env === "prd") {
    await sqs
      .sendMessage({
        QueueUrl: `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_export_hubspot.fifo`,
        MessageBody: JSON.stringify(data),
        MessageDeduplicationId: new Date().getTime().toString(),
        MessageGroupId: `prd-update-${new Date().getTime().toString()}`,
      })
      .promise()
      .catch((error) => {
        console.log("Erro ao enviar mensagem");
        //   utils.errorLog(error);
      });
  }
}

module.exports = {
  pushMessageToQueue,
  sendMessageToQueue,
};
