const { post, update, remove } = require("../services/nodefetch");

module.exports.execute = async (
  env,
  entity,
  resource,
  newData,
  oldData,
  method
) => {
  const entityPlans = `contracts_health_plans`;
  const newDataPlans = Object.assign([], newData[entityPlans]);

  oldData = oldData && oldData.length > 0 ? oldData[0] : oldData;

  delete newData[entityPlans];

  let oldDataPlans = getRealContract(oldData);

  let id = oldDataPlans ? oldDataPlans["id"] : null;

  oldDataPlans = oldDataPlans
    ? Object.assign([], oldDataPlans[entityPlans])
    : null;

  newData["company_contractor_company_id"] = oldData
    ? Number(oldData.id)
    : null;
  newData["payment_method"] = formatPaymentMethod(newData["payment_method"]);
  newData["contract_status"] = formatStatus(newData["contract_status"]);

  try {
    if (id) verifyError(await update(env, resource, newData, id));
    else id = verifyError(await post(env, resource, newData));

    if (newDataPlans.length > 0)
      await updateRelationTable(
        env,
        entity,
        entityPlans,
        newDataPlans,
        oldDataPlans,
        id
      );
  } catch (err) {
    throw err;
  }
};

async function updateRelationTable(
  env,
  entity,
  relationTable,
  newData,
  oldData,
  relation_id
) {
  addContractId(newData, relation_id);

  if (oldData && oldData.length > 0) {
    verifyError(await remove(env, relationTable, relation_id));
    return await createContractPlans(env, relationTable, newData);
  } else {
    return await createContractPlans(env, relationTable, newData);
  }
}

function formatPaymentMethod(paymentMethod) {
  const propTypes = {
    creditcard: 5,
    bankslip: 3,
  };

  return paymentMethod ? propTypes[paymentMethod] : undefined;
}

function formatStatus(status) {
  return status === "active" ? "executed" : status;
}

function addContractId(newData, id) {
  for (const element of newData) {
    element["id"] = Number(id);
  }
}

function getRealContract(oldData) {
  if (oldData && oldData.contracts && oldData.contracts.length > 0) {
    // const filtered = oldData.contracts.filter(
    //   b => b.status_source_value !== "cancelled"
    // );

    // return filtered.length > 0 ? filtered[0] : null;

    return oldData.contracts[0];
  }
}

async function createContractPlans(env, relationTable, newData) {
  let response = null;

  for (const element of newData) {
    response = await post(env, relationTable, element);
  }

  return verifyError(response);
}

function verifyError(response) {
  if (response.errorType) {
    throw JSON.parse(response.errorMessage);
  } else return response["id"];
}
