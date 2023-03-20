// Layers
const utils = require("utils");

// SQS
const awsSQS = require('aws-sdk/clients/sqs');
const sqs = new awsSQS();

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  console.log(event)

  const env = event.env

  try {
    await utils.pushMessageToQueue(sqs, {
      ...event,
      messageId: `${env}-message-Appointment-${new Date().getTime()}`,
      groupId: `${env}-group-Appointment-${new Date().getTime()}`
    }, `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_import_prontmed.fifo`);

    return { message: 'Mensagem entregue com sucesso' }

  } catch (err) {
    utils.handleError(err);
  }
};

