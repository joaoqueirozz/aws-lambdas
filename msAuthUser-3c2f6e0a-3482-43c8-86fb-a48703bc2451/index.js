// layers
const utils = require("utils.js");

// AWS services
const cognitoProviderLib = require("aws-sdk/clients/cognitoidentityserviceprovider");
const cognitoidentityserviceprovider = new cognitoProviderLib();

function getAuthParams(credentials) {
  try {
    const decoded = Buffer.from(credentials, "base64")
      .toString("utf-8")
      .split(":");

    return {
      username: decoded[0],
      password: decoded[1],
    };
  } catch (err) {
    throw utils.buildCustomError(400, "Credencial inválida");
  }
}

async function authorizeUser(clientId, poolId, credentials) {
  try {
    const authParams = getAuthParams(credentials);
    const data = await cognitoidentityserviceprovider
      .adminInitiateAuth({
        AuthFlow: "ADMIN_NO_SRP_AUTH",
        ClientId: clientId,
        UserPoolId: poolId,
        AuthParameters: {
          USERNAME: authParams.username,
          PASSWORD: authParams.password,
        },
      })
      .promise();

    if (!data) {
      throw utils.buildCustomError(
        500,
        `Erro inesperado autenticando o usuário ${username} no Cognito`
      );
    }

    return {
      accessToken: data.AuthenticationResult.IdToken,
      refreshToken: data.AuthenticationResult.RefreshToken,
    };
  } catch (err) {
    if (err.code === "NotAuthorizedException") {
      throw utils.buildCustomError(400, "Credencial inválida");
    }

    throw err;
  }
}

exports.handler = async (event, context) => {
  try {
    return await authorizeUser(event.clientId, event.poolId, event.credentials);
  } catch (err) {
    utils.handleError(err);
  }
};
