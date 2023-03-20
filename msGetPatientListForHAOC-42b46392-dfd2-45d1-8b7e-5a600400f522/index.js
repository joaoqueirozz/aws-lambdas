// layers
const utils = require("utils.js");
const awsSQS = require("aws-sdk/clients/sqs");
const sqs = new awsSQS();
const pgknex = require("pgknex");

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const env = utils.assertRequiredValue("env", event.env, "string");

    const schema = utils.assertRequiredValue(
      "schema",
      event.db_schema,
      "string"
    );

    return env;

    await pgknex.connect("connection_params");

    // obtém os pacientes
    const patients = await pgknex.select(
      `select id, document_identification_primary from ${schema}.lives where document_identification_primary is not null`
    );

    pgknex.disconnect();

    

    if (!patients || patients.length === 0) {
      return {
        ieStatus: "N",
        dsMsgErro: "no patients to process",
      };
    }

    const url = `https://sqs.us-east-1.amazonaws.com/707583345549/${env}_import_haoc`;

    patients.forEach(function(patient) {

      const message = {
        env,
        schema,
        payload:{
          nrCpf: patient.document_identification_primary
        }
      };

      await sqs
        .sendMessage({
          QueueUrl: url,
          DelaySeconds: "0",
          MessageBody: JSON.stringify(message),
        })
        .promise();


      })
      return {
        ieStatus: "S",
        dsMsgErro: "",
      };

  } catch (err) {
    utils.handleError(err);
  }
};
