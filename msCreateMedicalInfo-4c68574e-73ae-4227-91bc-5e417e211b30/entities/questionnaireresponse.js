const utils = require("utils");

async function validate(models, id, trx) {
    if (id) {
        const providers = await models.Provider.query().where('id', id).transacting(trx);

        if (!providers.length) {
            throw utils.buildCustomError(409, 'O recurso faz referência a um Practitioner que não existe na base de dados');
        }
    }
}

async function save(models, event, trx) {

    // constraint via código
    await validate(models, event.data.main.data.provider_id, trx);

    // insere o HRA
    const ids = await models.SurveyConduct.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.survey_conducts`).transacting(trx);

    // formata o id da empresa que acabou de ser inserida
    const insertedId = parseInt(ids[0], 10);

    // verifica entidades aninhadas
    let responseList = event.data.secondary['survey_responses'];

    await saveResponses(models, event.db_schema, insertedId, responseList, null, trx);

    // mergeia os objetos inseridos num só para retorna para o cliente
    event.data.main.data.survey_responses = responseList;
    event.data.main.data.id = insertedId.toString();

    return event.data.main.data;

}

async function saveResponses(models, schema, insertedId, responseList, parentId, trx) {
    for (let i = 0; i < responseList.length; i++) {
        const response = responseList[i];
        let items;

        // move o sub-objeto item, caso exista
        if (response.item) {
            items = Object.assign([], response.item);
            delete response.item;
        }

        // insere a resposta
        response.episode_survey_conduct_id = insertedId;
        if (parentId) {
            response.parent_question_id = parentId;
        }
        const responseIds = await models.SurveyConduct.knex().insert(response, 'id').into(`${schema}.survey_responses`).transacting(trx);

        if (items) {
            const parentQuestionId = parseInt(responseIds[0], 10);
            await saveResponses(models, schema, insertedId, items, parentQuestionId, trx);
            response.item = items;
        }
    }
}

async function execute(models, event) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    try {
        // insere a empresa/endereço/contatos através de uma transação
        return await models.SurveyConduct.knex().transaction(async trx => {
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

module.exports = {
    execute,
    executeBundle
}