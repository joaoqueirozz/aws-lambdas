const utils = require("utils");
const models = require("models");
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

const { getControlTable } = require("./modules/dynamo/control");
const { importDataHubSpot } = require("./modules/requests/service-hubspot");
const { isIntegrationHubSpot } = require("./modules/utils/auxiliary");
const { sendMessageError } = require("./modules/errors/errorSlack");
let env;
let resourceType;
let id;

exports.handler = async (event) => {
  if (event.warmer) return 0;
  try {
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }
    console.log(JSON.stringify(event.Records));

    for (let index = 0; index < event.Records.length; index++) {
      const body = utils.assertRequiredValue(
        "body",
        JSON.parse(event.Records[index].body),
        "object"
      );

      const data = utils.assertRequiredValue("data", body.data, "object");

      const schema = utils.assertRequiredValue("schema", body.schema, "string");

      id = utils.assertRequiredValue("id", body.id, "number");

      resourceType = utils.assertRequiredValue(
        "resourceType",
        body.resourceType,
        "string"
      );

      let methodType = utils.assertRequiredValue(
        "methodType",
        body.methodType,
        "string"
      );

      env = utils.assertRequiredValue("env", body.env, "string");

      let type = body.type;

      // console.log(`>>> ${env} <<<`);
      console.log(`>>> ${resourceType} <<<`);
      console.log(`>>> ${methodType} <<<`);
      console.log(`>>> ${id} <<<`);

      const patient = resourceType === "Patient" ? true : false;
      resourceType = resourceType === "Patient" ? "Coverage" : resourceType;

      if (await isIntegrationHubSpot(resourceType, patient, methodType, data)) {
        try {
          const connection = await utils.getSsmParam(ssm, "connection_params");

          // Conecta no BD
          models.init(connection, schema);

          // Executa a query no BD
          let dwData =
            await require(`./entities/${resourceType.toLowerCase()}`).execute(
              id,
              models,
              utils,
              type,
              patient
            );

          if (dwData) {
            dwData = { ...dwData, ...data };
            // Busca os ids na tabela de controle
            id = patient ? dwData.id : id;

            let controlItem = await getControlTable(resourceType, id, env);

            console.log(
              controlItem
                ? ">>> Já existe na tabela de Controle <<<"
                : ">>> Não existe na tabela de Controle <<<"
            );
            methodType = !controlItem ? "create" : "update";
            methodType = controlItem && patient ? "update" : methodType;

            const response = await importDataHubSpot(
              dwData,
              resourceType,
              methodType,
              models,
              env
            );
            console.log(`>>> Values ${methodType}d successfully <<<`);
            return response;
          } else {
            // await sendMessageError(resourceType, id, err, env);
            console.log(">>> ERRO <<<");
          }
        } catch (err) {
          // sendMessageError(resourceType, id, err, env);
          console.log(">>> ERRO <<<");
          utils.handleError(err);
        } finally {
          models.destroy();
        }
      }
    }
  } catch (err) {
    utils.handleError(err);
  }
};
