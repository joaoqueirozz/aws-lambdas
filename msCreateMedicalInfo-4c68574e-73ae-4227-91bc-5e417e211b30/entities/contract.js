const utils = require("utils");

async function execute(models, event) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    try {
        // insere a empresa/endereço/contatos através de uma transação
        return await models.Contract.knex().transaction(async trx => {
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
    return await save(models, event, trx);
}

async function validate(models, id, company_id) {
    if (!id) {
        const contract = await models.Contract.query()
            .where('company_contractor_company_id', company_id)
            .where('status_source_value', '<>', 'cancelled');


        if (contract && contract.length > 0) {
            throw utils.buildCustomError(409, `Já existe contrato para esta empresa`); // 1
        }
    }
}

async function save(models, event, trx) {

    // valida o recurso
    await validate(models, event.data.main.data.contract_id, event.data.main.data.company_contractor_company_id);

    // Insere a empresa
    const ids = await models.Contract.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.${event.data.main.entity_name}`).transacting(trx);

    // Formata o id da empresa que acabou de ser inserida
    const insertedId = parseInt(ids[0], 10);

    let secondaryData = Object.assign([], event.data.secondary.data);

    // Atribui a referencia aos valores da tabela secundária
    for (let i = 0; i < secondaryData.length; i++) {
        secondaryData[i]['id'] = insertedId;
    }
    // Insere os médicos no care team
    await models.ContractHealthPlan.knex().insert(secondaryData).into(`${event.db_schema}.${event.data.secondary.entity_name}`).transacting(trx);
    event.data.main.data.id = insertedId.toString();

    return event.data.main.data;
}

module.exports = {
    execute,
    executeBundle
}