// Layers
const utils = require("utils.js");

// Map
const enums = require(`./map/enumerators`);

// modules
const ssm = require("./modules/ssm");
const lambda = require("./modules/lambda");
const dynamo = require("./modules/dynamodb");
const rds = require("./modules/rds");
const base = require("./modules/base");

exports.handler = async (event) => {
  let env = null;
  let resourceType = null;
  let id = null;

  if (event.warmer) return 0;

  try {
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }

    console.log(JSON.stringify(event));

    for (let index = 0; index < event.Records.length; index++) {
      const body = utils.assertRequiredValue(
        "body",
        JSON.parse(event.Records[index].body),
        "object"
      );
      const data = utils.assertRequiredValue("data", body.data, "object");
      const schema = utils.assertRequiredValue("schema", body.schema, "string");
      const modified = utils.assertRequiredValue(
        "modified",
        body.modified,
        "string"
      );

      let method = utils.assertRequiredValue(
        "methodType",
        body.methodType,
        "string"
      );

      id = utils.assertRequiredValue("id", body.id, "number");
      resourceType = utils.assertRequiredValue(
        "resourceType",
        body.resourceType,
        "string"
      );
      env = utils.assertRequiredValue("env", body.env, "string");

      console.log(`>>> ${resourceType} <<<`);
      console.log(`>>> ${method} <<<`);

      const patient = resourceType === "Patient" ? true : false;
      resourceType = resourceType === "Patient" ? "Coverage" : resourceType;

      // Inicia rotina de integração com a MV
      if (await base.isIntegrationMV(resourceType, data)) {
        // Busca parametros no SSM
        const params = await ssm.getConfig();

        // Abre conexão com o RDS
        await rds.connect(params.connection, schema);

        // Executa a query no BD
        const data = await rds.get(patient, id);

        if (data) {
          id = patient ? data.id : id;

          // Verifica se o atendimento existe na tabela de controle
          const control = await dynamo.getControlTable(env, resourceType, id);

          method = !control ? "create" : "update";
          method = control && patient ? "update" : method;

          if (!control) {
            // Converte e cria empresa
            await base.converAndImportData(
              null,
              params,
              env,
              "Organization",
              data,
              enums,
              method,
              data.companies.id,
              modified
            );

            // Converte e cria o contrato pai
            if (data.contracts.contract_id)
              await base.converAndImportData(
                null,
                params,
                env,
                "FatherContract",
                data,
                enums,
                method,
                data.contracts.contract_id,
                modified
              );

            // Converte e cria o contrato
            await base.converAndImportData(
              null,
              params,
              env,
              "Contract",
              data,
              enums,
              method,
              data.contracts.id,
              modified
            );
          }
          // Converte e cria o contrato
          await base.converAndImportData(
            control,
            params,
            env,
            resourceType,
            data,
            enums,
            method,
            id,
            modified
          );
        }
      }
    }
  } catch (err) {
    await lambda.lambdaSlackChatBot(
      env,
      resourceType,
      id,
      new Date().toISOString(),
      err
    );
    utils.handleError(err);
  } finally {
    await rds.disconnect();
  }
};
