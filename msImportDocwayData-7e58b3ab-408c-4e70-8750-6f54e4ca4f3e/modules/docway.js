const utils = require("utils.js");
const got = require('got');
const FormData = require('form-data');
const awsSSM = require('aws-sdk/clients/ssm');
const ssm = new awsSSM();

let docwayConfig;
let token;

async function init(env) {
    docwayConfig = docwayConfig || (await utils.getSsmParam(ssm, 'docway'))[env];
    token = token || await getAccessToken();
}

async function getAccessToken() {
    // extrai objeto
    const {
        authorization
    } = docwayConfig;

    // create form-data
    const body = new FormData();
    body.append('grant_type', authorization.grantType);
    body.append('scope', authorization.scope);

    // request access token
    const result = await got.post(authorization.url, {
        'body': body,
        'headers': {
            'Authorization': `Basic ${authorization.token}`
        },
        'responseType': 'json'
    });

    // return access token
    return result.body.access_token;
}

// async function createPatient(accessToken) {
//     // request access token
//     const result = await got.post('https://api-developer.docway.com.br/stage-client/api/patients', {
//         json: {
//             'Name': 'Camilo Raitz',
//             'HealthInsuranceNumber': '999999999',
//             'weight': 86,
//             'height': 183,
//             'age': 46,
//             'addresses:': [
//                 'Rua Hilda Breitenbauch',
//                 '81',
//                 'Centro',
//                 'Itajaí',
//                 'SC'
//             ],
//             'email': 'camilo@samisaude.com',
//             'userName': 'craitz'
//         },
//         headers: {
//             'Authorization': `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//         },
//         responseType: 'json'
//     });

//     // return access token
//     return result.body;
// }

// async function getPatient(accessToken, patientId) {
//     // request access token
//     const result = await got.get(`https://api-developer.docway.com.br/stage-client/api/patients/${patientId}`, {
//         headers: {
//             'Authorization': `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//         },
//         responseType: 'json'
//     });

//     // return access token
//     return result.body;
// }

// async function requestAppointment(accessToken, patientId) {
//     // request access token
//     const result = await got.post(`https://api-developer.docway.com.br/stage-appointment/api/patients/${patientId}/appointments`, {
//         headers: {
//             'Authorization': `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//         },
//         json: {
//             'BuyerId': '64e36d64-8c0f-4884-9835-ea5d827001e8',
//             'DateAppointment': '2021-06-26T16:00:00',
//             'Address': {
//                 'Street': 'Rua Vieira de Morais',
//                 'Number': 2110,
//                 'complement': 'Conjunto 801',
//                 'Neighborhood': 'Campo Belo',
//                 'Cep': '04617-007',
//                 'City': 'São Paulo',
//                 'State': 'SP'
//             },
//             'Type': 6,
//             'ContactNumber': '+5511985077858',
//             'Reason': 'Motivo de video',
//             'Specialty': {
//                 'Id': 1
//             }
//         },
//         responseType: 'json'
//     });

//     // return access token
//     return result.body;
// }

// async function getAppointments(accessToken) {
//     // request access token
//     const result = await got.post('https://api-developer.docway.com.br/stage-appointment/api/v2/partner/appointments', {
//         headers: {
//             'Authorization': `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//         },
//         json: {
//             'Start': 0,
//             'CurrentPage': 0,
//             'Limit': 25,
//             'StartDate': '2021-04-16T21:58:41.833Z',
//             'EndDate': '2021-04-17T21:58:41.833Z'
//         },
//         responseType: 'json'
//     });

//     // return access token
//     return result.body;
// }

async function getAppointmentDetails(appointmentId) {
    // extrai objeto
    const {
        appointmentDetails
    } = docwayConfig;

    // insere id na URL
    const url = appointmentDetails.url.replace(appointmentDetails.key, appointmentId);

    // request access token
    const result = await got.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        responseType: 'json'
    });

    // return access token
    return result.body;
}

module.exports = {
    init,
    getAppointmentDetails
}