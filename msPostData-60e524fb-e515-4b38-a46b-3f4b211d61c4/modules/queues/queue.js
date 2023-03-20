const awsSQS = require("aws-sdk/clients/sqs");
const sqs = new awsSQS();

module.exports = {
  async dispatchMessage(payload, env, entity) {
    return await sqs
      .sendMessage({
        QueueUrl: `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_export_dw.fifo`,
        MessageBody: JSON.stringify(payload),
        MessageDeduplicationId: `message-${entity.toLowerCase()}-${
          payload.id
        }-${new Date().getTime()}`,
        MessageGroupId: `group-${payload.id}-${new Date().getTime()}`,
      })
      .promise();
  },
};
