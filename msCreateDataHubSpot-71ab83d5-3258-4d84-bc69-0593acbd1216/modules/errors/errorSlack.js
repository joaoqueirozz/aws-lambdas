const utils = require("utils.js");
const lambdaLib = require("aws-sdk/clients/lambda");
const lambda = new lambdaLib();
module.exports = {
  async sendMessageError(resourceType, id, err, env) {
    try {
      if (env === "prd") {
        await utils.invokeLambda(lambda, `msSlackChatBot`, {
          lambda: "msCreateDataHubspot",
          resourceType,
          id,
          modified: new Date().toDateString(),
          err,
        });
      }
    } catch (error) {
      console.log(JSON.stringify(error));
      // utils.errorLog(error, env);
    }
  },
};
