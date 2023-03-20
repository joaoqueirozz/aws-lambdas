const utils = require("utils");
const { getByIdentifier } = require("./services/nodefetch");
const { getResourceMap } = require("./services/dynamodb");
const { convert } = require("./services/convert");
const { getResourceIdentifier } = require("./const/utils");

function getBodyResourcer(body) {
  const resource = body.reference.entity;
  return resource;
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.warmer) return 0;

  let env = "dev";

  try {
    console.log(JSON.stringify(event));

    let body = utils.assertRequiredValue("body", event, "object");
    let resource = getBodyResourcer(body);
    let entity = getResourceIdentifier(resource);
    let data = convert(await getResourceMap(env, entity.resource), body);
    const method = body.reference.method;

    console.log(JSON.stringify(data));

    let response = await getByIdentifier(
      env,
      entity.searchResource,
      entity.searchIdentifier,
      data[entity.identifier]
    );

    await require(`./entities/${entity.resource}`).execute(
      env,
      resource,
      entity.resource,
      data,
      response,
      method
    );

    console.log(`Processo realizado com sucesso!!!`);

    return;
  } catch (err) {
    utils.errorLog(err, env);
    utils.handleError(err);
  }
};
