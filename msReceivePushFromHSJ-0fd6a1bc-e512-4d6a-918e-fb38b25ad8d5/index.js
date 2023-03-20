const utils = require("utils.js");
const awsSQS = require("aws-sdk/clients/sqs");
const sqs = new awsSQS();

async function pushMessageToQueue(sqs, params, url) {
  try {
    return await sqs
      .sendMessage({
        QueueUrl: url,
        DelaySeconds: "0",
        MessageBody: JSON.stringify(params),
      })
      .promise();
  } catch (err) {
    throw err;
  }
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  console.log(JSON.stringify(event));

  try {
    const response = await pushMessageToQueue(
      sqs,
      event,
      `https://sqs.us-east-1.amazonaws.com/707583345549/${event.env}_import_hsj`
    );

    return {
      ieStatus: "S",
      idRecebimento: response.MD5OfMessageBody, // hash
      dsMsgErro: "",
    };
  } catch (err) {
    utils.handleError(err);
  }
};
