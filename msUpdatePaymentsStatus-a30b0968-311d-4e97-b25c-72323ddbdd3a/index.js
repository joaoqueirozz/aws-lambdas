const { execute } = require("./entities/getContracts");
const models = require("models");
const utils = require("utils");
const moment = require("moment-timezone");
const { getControlTable } = require("./modules/dynamo");
const { formatStatus } = require("./modules/auxiliary");
const { updateData } = require("./modules/request");

const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

async function getConnection() {
  const connection = await utils.getSsmParam(ssm, "connection_params");
  models.init(connection, "datawarehouse");
}
function convertDates() {
  const start = moment()
    .set({ hour: 0, minute: 0, second: 0 })
    .subtract(1, "days")
    .tz("America/Sao_Paulo");
  const end = moment()
    .set({ hour: 23, minute: 59, second: 59 })
    .subtract(1, "days")
    .tz("America/Sao_Paulo");

  return { start: start.toISOString(), end: end.toISOString() };
}

exports.handler = async (event) => {
  try {
    const { env } = event;
    await getConnection();
    const dateRange = convertDates();
    const params = await utils.getSsmParam(ssm, "hubspot-integration-config");

    const data = await execute(models, dateRange);
    for (let x = 0; x < data.length; x++) {
      const item = await getControlTable(
        "Coverage",
        data[x].beneficiaries.id,
        env
      );

      if (item) {
        const status = formatStatus(data[x].status_source_value);
        if (status) {
          const payload = {
            status_de_pagamento: status,
            contact_id: item.id_external,
          };
          await updateData(payload, params);
        } else {
          console.log("Status de pagamento inválido!");
        }
      }
    }
  } catch (error) {
    utils.handleError(error);
  }
};
