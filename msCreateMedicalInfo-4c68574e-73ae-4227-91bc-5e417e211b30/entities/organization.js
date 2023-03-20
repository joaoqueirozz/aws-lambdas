const utils = require("utils");

function getConfig(models, type) { // O(f(n) = 1 + 1 -> O(1)
    switch (type) {
        case 'ins': {
            return { // 1
                tablenames: {
                    main: "health_insurances",
                    location: "health_insurance_locations",
                    contact: "health_insurance_contacts"
                },
                foreignKey: 'health_insurance_id',
                model: models.HealthInsurance,
                eagerLoading: 'health_insurance_locations',
                type: 'ins'
            }
        }
        case 'prov': {
            return { // 1
                tablenames: {
                    main: "care_sites",
                    location: "care_site_locations",
                    contact: "care_site_contacts"
                },
                foreignKey: 'care_site_id',
                model: models.CareSite,
                eagerLoading: '[care_site_locations, care_site_contacts]',
                type: 'prov'
            }
        }
        case 'pay': {
            return { // 1
                tablenames: {
                    main: "companies",
                    location: "company_locations",
                    contact: "company_contacts"
                },
                foreignKey: 'company_id',
                model: models.Company,
                eagerLoading: 'company_locations',
                type: 'pay'
            }
        }
    }
}

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(models, event) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    try {

        // get model config
        const config = getConfig(models, event.type); // O(1)

        // insere a empresa/endereço/contatos através de uma transação
        return await config.model.knex().transaction(async trx => {
            try {
                return await save(config, event, trx);
            } catch (err) {
                throw err; // O(1)
            }
        });

    } catch (err) {
        throw err; // O(1)
    } finally {
        models.destroy(); // O(1)
    }
}

async function executeBundle(models, event, trx) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    // get model config
    const config = getConfig(models, event.organizationType); // O(1)
    return await save(config, event, trx);
}

async function validate(type, model, data) { // O(f(n) = 1 + 1 -> O(1)
    let result;

    if (type === "ins")
        result = await model.query().where('national_code', data.national_code); // 1
    else if (type === "pay")
        result = await model.query().where('document_identification_primary', data.document_identification_primary); // 1

    if (result && result.length > 0) {
        throw utils.buildCustomError(409, 'A empresa já existe na base de dados'); // 1
    }
}

async function save(config, event, trx) {

    // declara e inicializa o esquema
    const schema = event.db_schema; // 1

    // verifica se a empresa existe
    await validate(event.organizationType, config.model, event.data.main.data); // O(1)

    // insere a empresa
    const ids = await config.model.knex().insert(event.data.main.data, 'id').into(`${schema}.${config.tablenames.main}`).transacting(trx); // O(1)

    // formata o id do paciente que acabou de ser inserido
    const insertedId = parseInt(ids[0], 10); // O(1)

    // verifica entidades aninhadas
    const locationsObj = event.data.secondary[config.tablenames.location]; // O(1)
    const contactsObj = event.data.secondary[config.tablenames.contact]; // O(1)

    // insere o endereço
    if (locationsObj) {
        locationsObj[config.foreignKey] = insertedId; // O(1)
        await config.model.knex().insert(locationsObj).into(`${schema}.${config.tablenames.location}`).transacting(trx); // O(1)
    }

    // insere o contato
    if (contactsObj) {
        contactsObj[config.foreignKey] = insertedId; // O(1)
        await config.model.knex().insert(contactsObj).into(`${schema}.${config.tablenames.contact}`).transacting(trx); // O(1)
    }

    // mergeia os objetos inseridos num só para retorna para o cliente
    extend(event.data.main.data, event.data.secondary[config.tablenames.location]);
    extend(event.data.main.data, event.data.secondary[config.tablenames.contact]);
    event.data.main.data.id = insertedId.toString();

    return event.data.main.data;
}

module.exports = {
    execute,
    executeBundle
}