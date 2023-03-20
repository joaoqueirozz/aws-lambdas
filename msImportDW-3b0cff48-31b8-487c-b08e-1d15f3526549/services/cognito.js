// AWS services
const cognitoProviderLib = require('aws-sdk/clients/cognitoidentityserviceprovider');
const cognitoidentityserviceprovider = new cognitoProviderLib();

/**
 * Cognito Service that handles requests to AWS Cognito
 */
 module.exports = {
    authenticate: async function () {
        const token = await cognitoidentityserviceprovider.adminInitiateAuth({
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            ClientId: '2vgbjdv8u4lgemcr9sg2p96c6c',
            UserPoolId: 'us-east-1_nCp4IIN6L',
            AuthParameters: {
                USERNAME: 'beneficiary',
                PASSWORD: 'q4lMA1ar_P1ef0Rop'
            }
        }).promise();

        if (!token) throw buildCustomError(500, `Erro inesperado autenticando o usuário gympass no Cognito`);
        
        return token.AuthenticationResult.IdToken;
    }
}