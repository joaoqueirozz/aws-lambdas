const { post, update } = require("../services/nodefetch");

module.exports.execute = async (
  env,
  entity,
  resource,
  newData,
  oldData,
  method
) => {
  const entityContacts = `${entity}_contacts`;
  const entityLocations = `${entity}_locations`;

  const newDataContacts = Object.assign({}, newData[entityContacts]);
  const newDataLontacts = Object.assign({}, newData[entityLocations]);

  oldData = oldData && oldData.length > 0 ? oldData[0] : oldData;
  let id = oldData ? oldData.id : null;

  delete newData[entityContacts];
  delete newData[entityLocations];

  try {
    if (id) verifyError(await update(env, resource, newData, id));
    else id = verifyError(await post(env, resource, newData));

    if (newDataContacts)
      await updateRelationTable(
        env,
        entity,
        entityContacts,
        newDataContacts,
        oldData ? oldData[entityContacts] : null,
        id
      );

    if (newDataLontacts)
      await updateRelationTable(
        env,
        entity,
        entityLocations,
        newDataLontacts,
        oldData ? oldData[entityLocations]: null,
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
  const entityId = `${entity}_id`;

  formatAddress(newData);

  if (newData && oldData) {
    newData[entityId] = Number(relation_id);

    const response = await update(env, relationTable, newData, oldData.id);
    return verifyError(response);
  } else if (newData && !oldData) {
    newData[entityId] = Number(relation_id);

    const response = await post(env, relationTable, newData);
    return verifyError(response);
  }
}

function formatAddress(newData) {
  if (newData["address_1"]) {
    newData["address_1"] = `${newData["address_1"]}, ${newData["number"]}`;
    delete newData["number"];

    if (newData["complement"]) {
      newData[
        "address_1"
      ] = `${newData["address_1"]}, ${newData["complement"]}`;

      delete newData["complement"];
    }
  }
}

function verifyError(response) {
  if (response.errorType) {
    throw JSON.parse(response.errorMessage);
  } else return response.id;
}
