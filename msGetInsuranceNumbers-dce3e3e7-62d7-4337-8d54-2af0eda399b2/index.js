// layers
const utils = require("utils.js");
const pgknex = require("pgknex");

function buildQueryInsuranceNumbers(requester, age, status) {
  const query = [];

  query.push(`SELECT DISTINCT nr_carteirinha `);
  query.push(`FROM mv_data.invoices i `);
  query.push(`WHERE i.nm_contratado_solicitante LIKE '%${requester}%' `);
  query.push(`AND current_date::date - dt_autorizacao::date < ${age} `);
  query.push(`AND status_guia='${status}'`);

  return query.join("");
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    let requester = 'LABI';
    if (event.requester) {
      requester = utils.assertRequiredValue("requester", event.requester, "string");
    }

    let age = 180;
    if (event.age) {
      age = utils.assertRequiredValue("age", event.age, "number");
    }

    let status = 'AUTORIZADA';
    if (event.status) {
      status = utils.assertRequiredValue("status", event.status, "string");
    }

    // conecta no DW
    await pgknex.connectWithParams({
      host: "aqr-sami-rds.cluster-ctxsv2axpjoj.us-east-1.rds.amazonaws.com",
      port: 5432,
      database: "sami_aqr_db",
      user: "root",
      password: "tiVuqe3*FudrLSofeN$=",
    });

    // obtém os atendimentos do DW
    return await pgknex.select(
      buildQueryInsuranceNumbers(requester, age, status)
    );
  } catch (err) {
    utils.handleError(err);
  } finally {
    pgknex.disconnect();
  }
};