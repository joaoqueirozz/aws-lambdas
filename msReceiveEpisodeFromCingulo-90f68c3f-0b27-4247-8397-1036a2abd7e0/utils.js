const { isNil, isArray, isObject } = require('lodash');
// Função de configuração para o merge entre dois objetos JOSN
function mergeOptions(dest, src) {
    // se o objeto origem é null ou undefined
    if (isNil(src)) {
        return dest;
    }

    // se o objeto destino é null ou undefined
    if (isNil(dest)) {
        return src;
    }

    // se o objeto origem é do tipo Array
    if (isArray(src)) {
        // percorre o array e faz o merge recursivo de cada item
        for (let i = 0; i < src.length; i++) {
            dest[i] = mergeOptions(dest[i], src[i]);
        }

        return dest;
    }

    // se o objeto origem é do tipo Object
    if (isObject(src)) {
        // percorre os atributos e faz o merge recursivo de cada um
        for (let prop in src) {
            dest[prop] = mergeOptions(dest[prop], src[prop]);
        }

        return dest;
    }

    return src;
}

async function generateKey(kms) {
    try {
        return await kms.generateDataKey({
            KeyId: 'alias/esbsamihealth',
            KeySpec: 'AES_256'
        }).promise();
    } catch (err) {
        throw err;
    }
}

async function encryptData(kms, crypto, data) {
    try {
        // pede uma chave de criptografia ao KMS, utilizando a CMK (client master key)
        const key = await generateKey(kms);

        // criar um encriptador utilizando o módulo Crypto do próprio NodeJS
        const cipher = crypto.createCipheriv('aes256', key.Plaintext, Buffer.from('0000000000000000'));

        // encripta o dado
        return {
            encryptedKey: key.CiphertextBlob,
            encryptedData: cipher.update(data, 'utf-8', 'base64') + cipher.final('base64')
        }
    } catch (err) {
        throw err;
    }
}

async function decryptData(kms, crypto, data, encryptedKey) {
    try {
        // usa o KMS para decriptar a chave
        const key = await kms.decrypt({
            CiphertextBlob: Buffer.from(encryptedKey, 'base64')
        }).promise();

        // cria o decriptador
        const decipher = crypto.createDecipheriv('aes256', key.Plaintext, Buffer.from('0000000000000000'));

        // decripta o dado
        return decipher.update(data, 'base64', 'utf-8') + decipher.final('utf-8');
    } catch (err) {
        throw err;
    }
}

function buildCustomError(httpStatus, cause, fhirError = {}) {
    switch (httpStatus) {
        case 400: {
            return {
                httpStatus,
                type: 'BadRequest',
                cause,
                fhirError
            };
        }
        case 404: {
            return {
                httpStatus,
                type: 'NotFound',
                cause
            };
        }
        case 409: {
            return {
                httpStatus,
                type: 'DataIntegrityViolation',
                cause
            };
        }
        case 500: {
            return {
                httpStatus,
                type: 'InternalServerError',
                cause
            };
        }
        default: {
            return {
                httpStatus: 500,
                type: 'InternalServerError',
                cause
            };
        }
    }
}

function handleError(err) {
    if (err.httpStatus) { // json de erro já montado
        throw JSON.stringify(err);
    } else if (typeof err === 'object') { // erro cru vindo de um outro lambda
        let msgObject;

        if (err.errorMessage) {
            try {
                msgObject = JSON.parse(err.errorMessage);
            } catch (errCatch) {
                throw JSON.stringify(buildCustomError(500, err.errorMessage));
            }

            if (msgObject.httpStatus) {
                throw err.errorMessage;
            } else {
                throw JSON.stringify(buildCustomError(500, err.errorMessage));
            }
        } else {
            throw JSON.stringify(buildCustomError(500, err.toString()));
        }
    } else if (typeof err === 'string') { // erro cru vindo de um outro lambda
        throw JSON.stringify(buildCustomError(500, JSON.err));
    } else {
        throw JSON.stringify(buildCustomError(500, 'Erro inesperado'));
    }
}

async function getSsmParam(ssm, paramName) {
    try {
        const data = await ssm.getParameter({
            Name: paramName
        }).promise();

        return JSON.parse(data.Parameter.Value);
    } catch (err) {
        throw err;
    }
}

async function putSsmParam(ssm, paramName, value) {
    try {
        const data = await ssm.putParameter({
            Name: paramName,
            Value: value,
            Type: 'String',
            Overwrite: true
        }).promise();

        return JSON.parse(data);
    } catch (err) {
        throw err;
    }
}

async function invokeLambda(lambda, FunctionName, Payload) {
    try {
        const response = await lambda.invoke({
            FunctionName,
            InvocationType: 'RequestResponse',
            LogType: 'None',
            Payload: (Payload && JSON.stringify(Payload)) || '{}'
        }).promise();

        if (response.FunctionError) {
            throw JSON.parse(response.Payload);
        }

        return JSON.parse(response.Payload);
    } catch (err) {
        throw err;
    }
}

async function pushMessageToQueue(sqs, params, url) {
    try {
        return await sqs.sendMessage({
            QueueUrl: url,
            DelaySeconds: '0',
            MessageBody: JSON.stringify(params),
            MessageDeduplicationId: params.messageId.toString(),
            MessageGroupId: params.groupId.toString()
        }).promise();
    } catch (err) {
        throw err;
    }
}

function assertRequiredValue(key, value, type) {
    if (value === undefined || value === null) {
        throw buildCustomError(400, `parâmetro não informado [${key}]`);
    }

    const actualtype = typeof value;

    if (type !== actualtype) {
        switch (type) {
            case 'number': {
                if (actualtype === 'string') {
                    if (value.trim().length === 0) {
                        throw buildCustomError(400, `parâmetro não informado [${key}]`);
                    }

                    if (isNaN(value)) {
                        throw buildCustomError(400, `parâmetro inválido [${key}]`);
                    }

                    return Number(value);
                }
            }
            case 'string': {
                return value.toString();
            }
            case 'array': {
                if (actualtype !== 'object' || !Array.isArray(value)) {
                    throw buildCustomError(400, `parâmetro inválido [${key}]`);
                } else {
                    return value;
                }
            }
            default: {
                throw buildCustomError(400, `parâmetro inválido [${key}]`);
            }
        }
    }

    if (typeof value === 'string' && value.trim().length === 0) {
        throw buildCustomError(400, `parâmetro não informado [${key}]`);
    }

    return value;
}

/**
 * Function to print log message with event
 * @param {String} message required
 * @param {String} enviroment required
 * @returns Log message in console or cloudwatch
 */
 function infoLog(message, enviroment = 'DEV') {
    console.info(`ENVIROMENT ${enviroment.toUpperCase()}: ${JSON.stringify(message)}`);
  }
  
  /**
  * Function to print log message with event
  * @param {String} message required
  * @param {String} enviroment required
  * @returns Log message in console or cloudwatch
  */
  function errorLog(message, enviroment = 'DEV') {
    console.error(`ENVIROMENT ${enviroment.toUpperCase()}: ${JSON.stringify(message)}`);
  }
  
  /**
  * Function to print log message with event
  * @param {String} message required
  * @param {String} enviroment required
  * @returns Log message in console or cloudwatch
  */
  function warnLog(message, enviroment = 'DEV') {
   console.warn(`ENVIROMENT ${enviroment.toUpperCase()}: ${JSON.stringify(message)}`);
  }

module.exports = {
    buildCustomError,
    handleError,
    getSsmParam,
    putSsmParam,
    invokeLambda,
    pushMessageToQueue,
    assertRequiredValue,
    generateKey,
    encryptData,
    decryptData,
    mergeOptions,
    errorLog,
    infoLog,
    warnLog
};