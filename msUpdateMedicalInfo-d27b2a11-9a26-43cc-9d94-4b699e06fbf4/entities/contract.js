const utils = require('utils.js');

async function execute(event, client, models) {
    try {
        return await models.Contract.knex().transaction(async trx => {
            try {
                event.data.main.data['id'] = event.id;

                const data = await client(`${event.db_schema}.contracts`).where('id', '=', event.id).update(event.data.main.data).returning('*').transacting(trx);

                if (data && data.length > 0) {
                    let secondaryData = Object.assign([], event.data.secondary.data);

                    // se foi passado algum plano pra atualização, prossiga... senão, não faz nada
                    if (secondaryData && secondaryData.length > 0) {
                        // Atribui a referencia aos valores da tabela secundária
                        for (let i = 0; i < secondaryData.length; i++) {
                            secondaryData[i]['id'] = event.id;
                        }

                        // remove os planos antigos
                        await client(`${event.db_schema}.contracts_health_plans`).where('id', '=', event.id).del().transacting(trx);

                        // Insere os novos planos
                        await client(`${event.db_schema}.contracts_health_plans`).insert(secondaryData).into(`${event.db_schema}.${event.data.secondary.entity_name}`).transacting(trx);
                    }

                    return data[0];
                } else {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }
            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
}

module.exports = {
    execute
}