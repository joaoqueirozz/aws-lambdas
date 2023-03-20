const utils = require("utils");

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(models, event) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    try {
        // insere a empresa/endereço/contatos através de uma transação
        return await models.Life.knex().transaction(async trx => {
            try {
                return await save(models, event, trx);
            } catch (err) {
                throw err; // O(1)
            }
        });

    } catch (err) {
        throw buildErrorMessage(err);
    } finally {
        models.destroy(); // O(1)
    }
}

async function executeBundle(models, event, trx) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    try {
        return await save(models, event, trx);
    } catch (err) {
        throw buildErrorMessage(err);
    }
}

async function save(models, event, trx) {

    // insere o paciente
    const ids = await models.Life.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.lives`).transacting(trx);

    // formata o id do paciente que acabou de ser inserido
    const insertedId = parseInt(ids[0], 10);

    // verifica entidades aninhadas
    const locationsObj = event.data.secondary['life_locations'];
    const contactsObj = event.data.secondary['life_contacts'];

    // insere o endereço
    if (locationsObj) {
        locationsObj.life_id = insertedId;
        await models.Life.knex().insert(locationsObj).into(`${event.db_schema}.life_locations`).transacting(trx);
    }

    // insere o contato
    if (contactsObj) {
        contactsObj.life_id = insertedId;
        await models.Life.knex().insert(contactsObj).into(`${event.db_schema}.life_contacts`).transacting(trx);
    }

    // mergeia os objetos inseridos num só para retorna para o cliente
    extend(event.data.main.data, event.data.secondary['life_locations']);
    extend(event.data.main.data, event.data.secondary['life_contacts']);
    event.data.main.data.id = insertedId.toString();

    return event.data.main.data;
}

function buildErrorMessage(err) {
    switch (err.constraint) {
        case 'lives_pk':
            throw utils.buildCustomError(409, 'Chave primária duplicada');
        case 'lives_un_identification_app':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse identificador de aplicativo');
        case 'lives_un_identification_card':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse número de carteirinha');
        case 'lives_un_identification_health':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse número de cartão SUS');
        case 'lives_un_identification_primary':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse CPF');
        case 'lives_un_identification_secondary':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse RG');
        default:
            throw utils.buildCustomError(400, err.detail || err.message);
    }
}

module.exports = {
    execute,
    executeBundle
}