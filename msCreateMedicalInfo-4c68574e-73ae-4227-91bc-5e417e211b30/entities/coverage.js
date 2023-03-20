const utils = require("utils");

async function execute(models, event) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    try {
        // insere a empresa/endereço/contatos através de uma transação
        return await models.Beneficiary.knex().transaction(async trx => {
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

async function validate(models, life_id) {
    const beneficiary = await models.Beneficiary.query()
        .where('life_id', life_id)
        .where('status_source_value', '<>', 'cancelled');

    if (beneficiary && beneficiary.length > 0) {
        throw utils.buildCustomError(409, `Já existe beneficiário para este membro`); // 1
    }
}

async function save(models, event, trx) {

    // valida o recurso
    await validate(models, event.data.main.data.life_id);

    // Insere a empresa
    const ids = await models.Beneficiary.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.beneficiaries`).transacting(trx);

    event.data.main.data.id = ids[0].toString();

    return event.data.main.data;
}

function buildErrorMessage(err) {
    switch (err.constraint) {
        case 'beneficiaries_pk':
            throw utils.buildCustomError(409, 'Chave primária duplicada');
        case 'beneficiaries_un_identification_app':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse identificador de aplicativo');
        case 'beneficiaries_un_identification_card':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse número de carteirinha');
        default:
            throw utils.buildCustomError(400, err.detail || err.message || err.cause || err);
    }
}

module.exports = {
    execute,
    executeBundle
}