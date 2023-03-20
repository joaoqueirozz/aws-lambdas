const { post, update } = require("../services/nodefetch");

module.exports.execute = async (
  env,
  entity,
  resource,
  newData,
  oldData,
  method
) => {
  let id = oldData ? oldData.id : null;

  try {
    if (id) verifyError(await update(env, resource, newData, id));
    else id = verifyError(await post(env, resource, newData));
  } catch (err) {
    throw err;
  }
};

function verifyError(response) {
  if (response.errorType) {
    throw JSON.parse(response.errorMessage);
  } else return response.id;
}
