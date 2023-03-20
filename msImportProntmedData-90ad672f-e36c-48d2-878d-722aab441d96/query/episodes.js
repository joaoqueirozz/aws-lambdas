const utils = require("utils");

async function execute(models, schema, data, table, episode, trx) {
    try {

        let insertedData;

        for (let index = 0; index < data.length; index++) {
            let item = data[index];

            // Verificar se o profissional já existe
            if (table === "providers") {
                episode['provider_id'] = await validade(models, item.national_provider_identification);
            }

            // Atribui o id da provedor nas tabelas relacionadas
            if (table !== "providers") item['provider_id'] = episode['provider_id'];

            // Atribui o id da vida nas tabelas relacionadas
            if (table !== "providers") item['life_id'] = episode['life_id'] || null;

            // Atribui o id do atendimento nas tabelas relacionadas
            if (table !== "episodes" && table !== "providers") item['episode_id'] = episode['episode_id'];

            // Atribui a data do atendimento no encaminhamento
            if (table === "referral") item['start_at'] = episode['start_at'];

            // Atribui a data do atendimento no medicamento
            if (table === "drug_exposures" && !item['start_at']) item['start_at'] = episode['start_at'];

            // Cria registrno do DW
            if (table === "providers" && !episode['provider_id']) {
                insertedData = (await models.Episode.knex().insert(item).into(`${schema}.${table}`).returning('*').transacting(trx))[0];
                episode['provider_id'] = insertedData['id'];
            } else if (table !== "providers")
                insertedData = (await models.Episode.knex().insert(item).into(`${schema}.${table}`).returning('*').transacting(trx))[0];
        }

        return insertedData;
    } catch (err) {
        console.log(JSON.stringify(err));
        throw utils.buildCustomError(400, err.detail || err.message);
    }
}

async function validade(models, identification) {
    const results = await models.Provider.query()
        .where('national_provider_identification', identification);

    if (results.length > 0)
        return results[0].id;
    else return null;
}

module.exports = {
    execute
};