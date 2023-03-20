 /**
 * Layers
 */
  const utils = require("utils");
  const models = require("models");
  const mapping = require("dataMapping");
  
  /**
   * Get data entities
   */
  const { getLive } = require("./entities/life");
  const { executeCreateConduct } = require("./entities/create");
  
  /**
   * Enumerators
   */
  
  const enumerators = require("./map/enumerators");
  const responses = require("./map/responses");
  
  /**
   * SSM lib
   */
  const SsmLib = require("aws-sdk/clients/ssm");
  const ssm = new SsmLib();
  
  const { getControl } = require("./modules/dynamo/control");
  
  const { sendMessageError } = require("./errors/errorSlack");
  
  function normalizeData(values, patient) {
    responses.map((item) =>
      values.push({
        answered_at: patient.program_executions[0].procedure_time,
        attribute: {
          key: item,
          value: patient[item],
        },
      })
    );
    return values;
  }
  
  exports.handler = async (event) => {
    let { env } = JSON.parse(event.Records[0].body);
    try {
      if (!event.Records || event.Records.length === 0) {
        return {
          message: "Nothing to process",
        };
      }
      const { Records } = event;
  
      // recupera somente as questões
      const { data } = JSON.parse(Records[0].body);
  
      const connection = await utils.getSsmParam(ssm, "connection_params");
  
      let database = "datawarehouse";
      if (env !== "prd") {
        database = `${database}_${env}`;
      }
      models.init(connection, database);
      console.log("data.key");
      console.log(data.key);
      const { id } = await getLive(models, data.key);
      const { values, patient } = data;
      const dataValue = await normalizeData(values, patient);
  
      let conduct = {
        life_id: id,
        survey_concept_id: 5,
        survey_source_value: "bf5e6598-f21d-4da9-b709-84a4fce81117",
        survey_synonym_id: 5,
        survey_concept_id: 5,
      };
  
      for (let x = 0; x < dataValue.length; x++) {
        if (dataValue[x].attribute !== null) {
          const exists = await getControl(env, id);
          const response = await mapping.convertDataMapping(
            env,
            models,
            "Vitalk",
            "Survey",
            dataValue[x],
            enumerators,
            "Import",
            "response"
          );
  
          conduct.start_at = dataValue[x].created_at;
          conduct.stop_at = dataValue[x].answered_at;
  
          await executeCreateConduct(
            models,
            env,
            database,
            conduct,
            response,
            exists
          );
        }
      }
  
      console.log({
        status: "Dados inseridos com sucesso no DW",
        sended: dataValue.length,
      });
    } catch (error) {
      // sendMessageError("create", "vitalk", error, env);
      //  utils.errorLog(error);
      utils.handleError(error);
    } finally {
      models.destroy();
    }
  };