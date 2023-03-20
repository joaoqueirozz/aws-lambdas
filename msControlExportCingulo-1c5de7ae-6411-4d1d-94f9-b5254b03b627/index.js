// layers
const utils = require("utils.js");

//dynamoDB
const awsDynamodb = require("aws-sdk/clients/dynamodb");
const dynamo = new awsDynamodb();
const converter = awsDynamodb.Converter;

// Modules
const rds = require("./modules/rds");

exports.handler = async (event, context, callback) => {
  try {
    const env = utils.assertRequiredValue("env", event.env, "string");
    console.log(`>>> env: ${env} <<<`);

    const schema = utils.assertRequiredValue(
      "db_schema",
      event.db_schema,
      "string"
    );
    console.log(`>>> schema: ${schema} <<<`);

    const today = new Date().toISOString().slice(0, 10);

    console.log(`>>> Tabela de controle para o dia: ${today} <<<`);

    const data = await dynamo
      .scan({ TableName: `PatientsCingulo_${env}` })
      .promise();

    console.log(`>>> Qtd de membros na tabela controle: ${data.Count} <<<`);

    // conecta no postgres
    await rds.connect();

    for (let i = 0; i < data.Count; i++) {
      const record = converter.unmarshall(data.Items[i]);

      if (record.date === today) {
        // Envia as novas linhas para a tabela de controle
        const controlId = await rds.sendControl(record);
        console.log(controlId);
      }
    }

    callback(null, "Finished");

    return ">>> Importação finalizada <<<";
  } catch (err) {
    utils.handleError(err);
  } finally {
    rds.disconnect();
  }
};
