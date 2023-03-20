// layers
const utils = require('utils.js');
const AWS = require('aws-sdk');

// AWS services
const cognitoProviderLib = require('aws-sdk/clients/cognitoidentityserviceprovider');
const cognitoidentityserviceprovider = new cognitoProviderLib();

function getAuthParams(credentials) {
    try {
        const [username, password] = Buffer.from(credentials.split(' ')[1], 'base64').toString('ascii').split(':');

        return {
            username,
            password
        }
    } catch (err) {
        throw utils.buildCustomError(400, 'Credencial inválida');
    }
}

async function authorizeUser(clientId, poolId, credentials) {
    try {
        const {
            username: USERNAME,
            password: PASSWORD
        } = getAuthParams(credentials);

        const data = await cognitoidentityserviceprovider.adminInitiateAuth({
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            ClientId: clientId,
            UserPoolId: poolId,
            AuthParameters: {
                USERNAME,
                PASSWORD
            }
        }).promise();

        if (!data) {
            throw utils.buildCustomError(500, `Erro inesperado autenticando o usuário ${username} no Cognito`);
        }

        return {
            access_token: data.AuthenticationResult.IdToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'Read'
        };
    } catch (err) {
        if (err.code === 'NotAuthorizedException') {
            throw utils.buildCustomError(400, `${err.code}: ${err.message}`);
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