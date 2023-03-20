// Layers
const mapping = require("dataTransform");
const enums = require("../map/enumerators");
const lambda = require("./lambda");
const dynamo = require("./dynamodb");

// Verifica se é recurso de integração MV
async function isIntegrationMV(resourceType, data) {
  return (
    (resourceType === "Coverage" && data["status"] !== "pending") ||
    resourceType === "Patient"
  );
}

// Converte payload
async function convertData(env, resourceType, data, enums, method) {
  // Converte dados de acordo com o mapa
  let payload = await mapping.convertDataMapping(
    env,
    null,
    "Mv",
    resourceType,
    data,
    enums,
    "Export",
    method
  );

  // Converte os dados de acordo com regras do cliente
  payload = convertDataMV(
    resourceType === "FatherContract" ? "Contract" : resourceType,
    payload,
    data
  );

  // Loga no CloudWatch
  console.log(`>>> ${JSON.stringify(payload)} <<<`);

  return payload;
}

// Converte e envia os dados para as tabelas auxiliares
async function convertAuxiliaryTable(env, param, data, payload) {
  const queryParameters = {
    cd_agrupamento_carencia: data["grace_type_id"],
    cd_plano: payload["cdPlano"],
    nr_cpf: payload["nrCpf"],
    dt_adesao: payload["dtAdmissao"],
    cd_mat_alternativa: payload["cdMatAlternativa"],
    sn_ativo: data["status"] === "active" || "draft" ? "S" : "N",
  };

  const insertQuery = await require("../queries/beneficiary-query").insert(
    queryParameters
  );

  console.log(
    `>>> Inserindo na tabela auxiliar ${JSON.stringify(insertQuery)} <<<`
  );

  return await lambda.lambdaAccessOracle(param[env], insertQuery);
}

// Coverter payload com regras de integração
function convertDataMV(resourceType, payload, data) {
  if (resourceType === "Coverage") {
    if (payload["nmSegurado"])
      payload["nmSegurado"] = regExCity(payload["nmSegurado"]);

    if (payload["nmMae"]) payload["nmMae"] = regExCity(payload["nmMae"]);

    if (payload["cdMatriculaTem"]) payload["tpUsuario"] = "D";

    if (payload["nrCns"] === "NA") payload["nrCns"] = "";

    if (payload["nrCelular"])
      payload["nrCelular"] = payload["nrCelular"].replace("+55", "");

    if (payload["nrTelefone"])
      payload["nrTelefone"] = payload["nrTelefone"].replace("+55", "");

    if (payload["nmCidade"])
      payload["nmCidade"] = regExCity(payload["nmCidade"]);

    if (payload["cdPlano"])
      payload["cdPlano"] =
        enums["health_plan_enum"][payload["cdPlano"]]["cd_plano"];
  }

  if (resourceType === "Contract") {
    if (payload["nm_cidade"])
      payload["nm_cidade"] = regExCity(payload["nm_cidade"]);

    payload["nr_endereco"] = payload["nr_endereco"].replace(/[^0-9 ]/g, "");

    payload["tp_contrato"] = payload["tp_contrato"] === "" ? "E" : "A";

    payload["nr_endereco"] =
      payload["nr_endereco"] === "S/N" || payload["nr_endereco"] === ""
        ? "0"
        : payload["nr_endereco"];

    payload["plano_contrato"] = getHealthPlans(
      data["contracts"]["beneficiaries"]
    );
  }

  payload = upperCaseObject(payload);

  return payload;
}

// Get health plans
function getHealthPlans(beneficiaries) {
  let healthPlan = {};
  const healthPlans = [];

  beneficiaries.forEach((beneficiary) => {
    const healthPlanOutput =
      enums["health_plan_enum"][beneficiary.health_plan_id];

    if (!checkDuplicatePlan(healthPlans, healthPlanOutput.cd_plano)) {
      healthPlan = healthPlanOutput;
      healthPlan["cd_tabela_preco"] =
        enums["health_plan_price_enum"][beneficiary.health_plan_cost_id];
      healthPlans.push(healthPlan);
    }
  });

  return healthPlans;
}

// Check duplicated health plans
function checkDuplicatePlan(healthPlans, id) {
  return healthPlans.some((healthPlan) => healthPlan.cd_plano === id);
}

// Converte objeto para maiusculo
function upperCaseObject(obj) {
  for (var prop in obj) {
    if (typeof obj[prop] === "string") {
      obj[prop] = obj[prop].toUpperCase();
    }
    if (typeof obj[prop] === "object") {
      upperCaseObject(obj[prop]);
    }
  }
  return obj;
}

// Converte e formata os valores do payload
function regExCity(str) {
  const map = {
    "-": " ",
    "-": "_",
    a: "á|à|ã|â|ä|À|Á|Ã|Â|Ä",
    e: "é|è|ê|ë|É|È|Ê|Ë",
    i: "í|ì|î|ï|Í|Ì|Î|Ï",
    o: "ó|ò|ô|õ|ö|Ó|Ò|Ô|Õ|Ö",
    u: "ú|ù|û|ü|Ú|Ù|Û|Ü",
    c: "ç|Ç",
    n: "ñ|Ñ",
  };

  for (let pattern in map) {
    str = str.replace(new RegExp(map[pattern], "g"), pattern);
  }

  return str.trim().toUpperCase();
}

async function converAndImportData(
  control,
  params,
  env,
  resourceType,
  data,
  enums,
  method,
  id,
  modified
) {
  const newResourceType =
    resourceType === "FatherContract" ? "Contract" : resourceType;

  // Busca os dados na tabela de controle
  control = !control
    ? await dynamo.getControlTable(env, newResourceType, id)
    : control;

  if (!control) {
    // Converte o payload de acordo com o mapa definido no Dynamo
    const payload = await convertData(env, resourceType, data, enums, method);
    // Envia os dados para o cliente
    const response = await lambda.lambdaImportData(
      env,
      newResourceType,
      params.integration,
      payload,
      method
    );
    // Grava os dados na tabela de controle
    if (method === "create" && !control)
      await dynamo.updateControlTable(
        env,
        newResourceType,
        id,
        response.entidadeId,
        modified
      );
    // Converte e cria dados na tabela auxiliar
    if (newResourceType === "Coverage")
      await convertAuxiliaryTable(env, params.connection_mv, data, payload);
  } else if (newResourceType === "Coverage" || newResourceType === "Patient") {
    // Converte o payload de acordo com o mapa definido no Dynamo
    const payload = await convertData(env, resourceType, data, enums, method);
    // Envia os dados para o cliente
    await lambda.lambdaImportData(
      env,
      newResourceType,
      params.integration,
      payload,
      method
    );
    // Converte e cria dados na tabela auxiliar
    if (newResourceType === "Coverage")
      await convertAuxiliaryTable(env, params.connection_mv, data, payload);
  }
}

module.exports = {
  convertData,
  isIntegrationMV,
  convertAuxiliaryTable,
  converAndImportData,
};
