const utils = require('utils.js');
const { mergeWith, isObject, get } = require('lodash');

// SSM
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

// Lambda
const lambdaLib = require("aws-sdk/clients/lambda");
const lambda = new lambdaLib();

// DynamoDB
const awsDynamodb = require("aws-sdk/clients/dynamodb");
const dynamo = new awsDynamodb();
const converter = awsDynamodb.Converter;

let enums = null;
let env = null;
let models = null;

async function convertDataMapping(environment, model, integration, entity, data, enumerator, mappingType, methodType) {

    // Busca mapa do DynamoDB
    const entityMap = await getDynamoMap(environment, integration, entity, mappingType);

    models = model
    env = environment
    enums = enumerator

    const mappingTypes = {
        Import: convertValueFromFieldMappingImport,
        Export: convertValueFromFieldMappingExport
    };

    const response = await mappingTypes[mappingType](entityMap[methodType]['map'], data, integration, mappingType);

    models = null;
    env = null;
    enums = null;

    return response;
}

// Busca dados do mapa na Dynamo
async function getDynamoMap(env, table, resource, mappingType) {
    try {
        const params = {
            TableName: `${table}_${mappingType}_${env}`,
            FilterExpression: 'omop_resource = :omop_resource',
            ExpressionAttributeValues: { ':omop_resource': { S: resource } }
        };

        const data = await dynamo.scan(params).promise();

        // Obtém o modelo de mapeamento do DynamoDB
        if (data.Items && data.Items.length > 0)
            return converter.unmarshall(data.Items[0]);

    } catch (err) {
        throw utils.buildCustomError(400, `Erro obtendo os dados do mapa do recurso [${resource}]`);
    }
}

// Converte valores pelo campos do mapa
async function convertValueFromFieldMappingExport(entity, data, integration, mappingType) {
    let response = {};

    const properties = Object.getOwnPropertyNames(entity);

    for (let i = 0; i < properties.length; i++) {
        const field = properties[i];

        if (isObject(entity[field])) {
            const item = validateMapping(entity[field], field);

            if (field.includes(".")) {
                const splittedProp = field.split('.');

                createStructure("Object", response, splittedProp[0]);
                await getValueFromType(response[splittedProp[0]], item, splittedProp[1], convertValue(data, item, item.reference), integration, mappingType);
            }
            else
                await getValueFromType(response, item, field, convertValue(data, item, item.reference), integration, mappingType);
        }
    }

    return response;
}

// Converte valores pelo campos do mapa
async function convertValueFromFieldMappingImport(entity, data, integration, mappingType) {
    let response = {};

    const properties = Object.getOwnPropertyNames(entity);

    for (let i = 0; i < properties.length; i++) {
        const field = properties[i];

        if (Array.isArray(entity[field])) {

            const dataElement = get(data, field);

            if (dataElement) {
                for (let dataIndex = 0; dataIndex < dataElement.length; dataIndex++) {
                    const dataElementIndex = dataElement[dataIndex];

                    for (let entityIndex = 0; entityIndex < entity[field].length; entityIndex++) {
                        const entityElement = entity[field][entityIndex];
                        const responseElement = await convertValueFromFieldMappingImport(entityElement, dataElementIndex, mappingType);

                        if (entityElement.entiyReference) {
                            createStructure("Array", response, entityElement.entiyReference);

                            if (!response[entityElement.entiyReference][dataIndex])
                                response[entityElement.entiyReference].push(responseElement);
                            else
                                response = mergeWith(response[entityElement.entiyReference][dataIndex], responseElement, utils.mergeOptions);
                        } else
                            response = mergeWith(response, responseElement, utils.mergeOptions);
                    }
                }
            }
        }
        else if (isObject(entity[field])) {
            const item = validateMapping(entity[field], field);

            if (entity[field].entiyReference) {
                createStructure("Object", response, entity[field].entiyReference);
                await getValueFromType(response[entity[field].entiyReference], item, item.reference, convertValue(data, item, field), integration, mappingType)
            }
            else
                await getValueFromType(response, item, item.reference, convertValue(data, item, field), integration, mappingType)
        }
    }

    return response;
}

// Cria a estrutura de um objeto
function createStructure(type, response, field) {
    if (type === "Object" && !response[field]) {
        response[field] = {};
    }

    if (type === "Array" && !response[field]) {
        response[field] = [];
    }
}

// Valida atributos do mapa
function validateMapping(item, element) {
    if (!item.type)
        throw utils.buildCustomError(400, `Tipo não encontrada para o item [${element}]`);
    else if (item.type === "search" && !item.query && !item.database)
        throw utils.buildCustomError(404, `Referência de busca não encontrada para o item [${element}]`);
    else
        return item;
}

// Converte o valor 
function convertValue(data, item, attribute) {
    const type = item.type;
    const defaultValue = item.default;
    let value = data[attribute] || "";

    if (String(attribute).includes("|")) {
        const splitedValue = attribute.split('|');
        value = get(data, splitedValue[0]);
        if (!value) {
            value = get(data, splitedValue[1]) || "";
        }
    } else {
        if (String(attribute).includes(".")) {
            value = get(data, `${attribute}`) || "";
        }
    }
    return !value && type != "search" && defaultValue ? defaultValue : value;
}

// Verifica tipo do valor definido
async function getValueFromType(response, item, field, value, integration, mappingType) {
    const { type } = item;

    switch (type) {
        case 'string':
            response[field] = getValueFromString(item, type, value);
            break;
        case 'number':
            response[field] = typeof value === type ? value : Number(value);
            break;
        case 'datetime':
            response[field] = getValueFromDateTime(item, type, value, mappingType);
            break;
        case 'enum':
            getValueFromEnum(response, item, field, value, mappingType);
            break;
        case 'relationship':
            response[field] = value ? await getValueFromRelationship(item, value, integration, mappingType) : "";
            break;
        case 'search':
            value ? await getValueFromSearch(response, item, field, value) : '';
            break;
        default:
            response[field] = value;
    }
}

// Converte valores do tipo STring
function getValueFromString(item, type, value) {

    switch (item.format) {
        case "ddd":
            return getValueFromFoneNumber(item.reference, item.format, value);
        case "ddi":
            return getValueFromFoneNumber(item.reference, item.format, value);
        case "phone":
            return getValueFromFoneNumber(item.reference, item.format, value);
        case "address":
            return typeof value === type ? value.split(',')[0] : String(value);
        case "number":
            return value.includes(',') ?
                typeof value === type ? value.split(',')[1].replace(' ', '') :
                    String(value) : "";
        case "complement":
            return value.includes(',') && value.split(',')[2] ? typeof value === type ?
                value.split(',')[2].replace(' ', '') : String(value) : "";
        default:
            return typeof value === type ? value : String(value);
    }
}

// Converte valores do tipo DateTime
function getValueFromDateTime(item, type, value, mappingType) {

    value = !value && mappingType === "Import" ? null : value;

    switch (item.format) {
        case "dd/mm/yyyy":
            return value ? new Date(value).toLocaleDateString("pt-br") : value;
        case "yyyy/mm/dd":
            return value ? new Date(value).toLocaleDateString("zh-Hans-CN") : value;
        case "yyyy-mm-dd":
            return value ? new Date(value).toISOString().slice(0, 10) : value;
        case "dd":
            return value ? value.getDate() : value;
        case "mm":
            return value ? value.getMonth() : value;
        case "yyyy":
            return value ? value.getYear() : value;
        default:
            return value ? new Date(value) : value;
    }
}

// Formata os valores de telefone
function getValueFromFoneNumber(reference, format, value) {
    if (value) {
        value = typeof value === format ? value : String(value);
        value = value ? value.replace(/[^0-9]+/g, '') : "";
        value = value.replace(/(\d)(\d{4})$/, "$1-$2");

        if (reference.includes('mobile')) {
            value = value.length === 10 ? "00" + value : value
            value = value.length === 12 ? "+55" + value : value
        }
        else if (reference.includes('home')) {
            value = value.length === 9 ? "00" + value : value
            value = value.length === 11 ? "+55" + value : value
        }

        if (value.length === 14 && format === 'ddi')
            return value.substring(0, 3)

        if (value.length > 11 && format === 'ddd')
            return value.substring(3, 5)

        if (value.length >= 10 && format === 'phone' && reference.includes('mobile'))
            return value.substring(value.length - 10, value.length)

        if (value.length >= 9 && format === 'phone' && reference.includes('home'))
            return value.substring(value.length - 9, value.length)

        return value;
    }
    else return value;
}

// Busca valor de relação no Dynamo conforme conversão definida
async function getValueFromRelationship(item, value, integration, mappingType) {

    const { convert } = item;

    if (convert && convert.includes(".")) {
        const table = convert.split('.')[0];
        const field = convert.split('.')[1];
        const primary = mappingType === "Export" ? "id" : "id_external";

        try {
            const params = {
                TableName: `${table}_${env}`,
                KeyConditionExpression: `${primary} = :${primary} and integration = :integration`,
                ExpressionAttributeValues: {
                    ":integration": { S: integration }
                },
            };

            params.ExpressionAttributeValues[`:${primary}`] = mappingType === "Export" ? { N: value.toString() } : { S: value.toString() };

            const data = await dynamo.query(params).promise();

            if (data.Items && data.Items.length > 0) {
                const newData = converter.unmarshall(data.Items[0]);
                return newData[field];
            }
            else
                throw utils.buildCustomError(404, `Id ${value} não encontrado na table ${table}`);

        } catch (err) {
            throw utils.buildCustomError(500, err);
        }
    }
    else throw utils.buildCustomError(404, `Atributo convert não mapeado`);
}

// Busca valor pelo enum definido
function getValueFromEnum(response, item, reference, value, mappingType) {

    let field = mappingType === "Export" ? item.reference : reference;

    if (field.includes(".") && mappingType === "Import") {
        const splittedReference = reference.split('.');
        field = splittedReference[1];

        createStructure("Object", response, splittedReference[0]);
        response = response[splittedReference[0]]
    }
    else if (field.includes('.'))
        field = field.split('.')[1];

    const enumerator = enums[field.replace('source_value', 'enum')];

    value = value || 'unknown'

    !enumerator[value] ? console.log(`Valor [${value}] não encontrado no enumerador [${field}]`) : null;

    value = !enumerator[value] && item.default ? item.default : value;

    if (enumerator[value])
        response = mergeWith(response, enumerator[value], utils.mergeOptions);
    else
        throw utils.buildCustomError(400, `Valor [${value}] não encontrado no enumerador [${field}]`);
}

// Busca valor pelo search definido
async function getValueFromSearch(response, item, field, value) {
    const { query, database } = item;
    const defaultValue = item.default;

    if (database === 'oracle')
        return await searchValueTableFromOracle(response, field, `${query}${value}`, defaultValue);
    else {
        if (String(query).includes('|')) {
            const splittedSearch = query.split('|');
            const splittedField = field.split('|');

            for (let index = 0; index < splittedSearch.length; index++) {
                const element = splittedSearch[index];
                const splittedTableField = element.split('.');
                const result = await searchValueTable(splittedTableField[0], splittedTableField[1], value);

                if (result) {
                    response[splittedField[index]] = result;
                    return;
                }
            }
        }
        else {
            const splittedTableField = query.split('.');
            response[field] = await searchValueTable(splittedTableField[0], splittedTableField[1], value);
        }
    }
}

// Busca valor na tabela do Oracle
async function searchValueTableFromOracle(response, field, queryData, defaultValue) {
    try {
        let param = await utils.getSsmParam(ssm, "connection_params_mv");

        const data = await utils.invokeLambda(lambda, `msAccessOracleMV`, {
            user: param[env].user,
            password: param[env].password,
            connectString: param[env].connectString,
            formatObject: true,
            queryData,
        });

        const searchField = queryData.match(/(?<=SELECT\s+).*?(?=\s+FROM)/gs)[0];

        response[field] = data.length > 0 ? data[0][searchField] : defaultValue;

    } catch (err) {
        throw utils.buildCustomError(500, err);
    }
}
// Busca valor na base de dados
async function searchValueTable(table, field, value) {
    return await require(`./search`).execute(models, table, field, value);
}

module.exports = {
    convertDataMapping
}
