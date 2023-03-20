const utils = require("utils");

async function execute(models, event) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    try {
        // insere a empresa/endereço/contatos através de uma transação
        return await models.Payment.knex().transaction(async trx => {
            try {
                return await save(models, event, trx);
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
    try {
        return await save(models, event, trx);
    } catch (err) {
        throw err; // O(1)
    }
}

async function validate(models, event) {

    if(event.data.main.data.contract_id && event.data.main.data.contract_id.length >= 13){

        const data = await models.Contract.query()
                .joinRelated('companies')
                .where('companies.document_identification_primary', event.data.main.data.contract_id);

        if (data && data.length > 0) {
            event.data.main.data.contract_id = data[0].id;
        }
        else 
            throw utils.buildCustomError(409, `O ${event.data.main.data.contract_id} CNPJ não foi localizado`); // 1
   }
}

async function save(models, event, trx) { // O(f(n) = 1 + 1 + ... + n -> O(1)

    // valida o recurso
    await validate(models, event)

    const ids = await models.Payment.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.payments`).transacting(trx);
    event.data.main.data.id = ids[0].toString();
    return event.data.main.data;
}

module.exports = {
    execute,
    executeBundle
}