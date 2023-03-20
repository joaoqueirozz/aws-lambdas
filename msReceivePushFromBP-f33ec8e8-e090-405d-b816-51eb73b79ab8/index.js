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

  try {
    console.log(event);

    const response = await pushMessageToQueue(
      sqs,
      event,
      `https://sqs.us-east-1.amazonaws.com/707583345549/${event.env}_import_bp`
    );

    // Hash MD5 do event
    const crypto = require("crypto");
    const pacote = JSON.stringify(event.payload);
    const hash = crypto.createHash("md5").update(pacote).digest("hex");

    console.log(`>>> Hash: ${hash} <<<`);

    return {
      ieStatus: "S",
      idRecebimento: response.MD5OfMessageBody, // hash
      dsMsgErro: "",
    };
  } catch (err) {
    utils.handleError(err);
  }
};
