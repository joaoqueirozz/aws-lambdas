// layers
const utils = require('utils.js');

// AWS services
const cognitoProviderLib = require('aws-sdk/clients/cognitoidentityserviceprovider');
const cognitoidentityserviceprovider = new cognitoProviderLib();

async function refreshToken(clientId, poolId, token) {
    try {
        const data = await cognitoidentityserviceprovider.adminInitiateAuth({
            AuthFlow: 'REFRESH_TOKEN',
            ClientId: clientId,
            UserPoolId: poolId,
            AuthParameters: {
                REFRESH_TOKEN: token
            }
        }).promise();

        if (!data) {
            throw utils.buildCustomError(500, `Erro inesperado atualizando o token no Cognito`);
        }

        return {
            accessToken: data.AuthenticationResult.IdToken,
        };
    } catch (err) {
        if (err.code === 'NotAuthorizedException') {
            throw utils.buildCustomError(400, 'Token inválido');
        }

        throw err;
    }
}

exports.handler = async (event, context) => {
    try {
        return await refreshToken(
            event.clientId,
            event.poolId,
            event.token
        );
    } catch (err) {
        utils.handleError(err);
    }
};