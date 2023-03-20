const utils = require('utils.js');

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(event, client) {
    try {
        // inicializa variáveis
        const schema = event.db_schema;
        const healthPlans = event.data.main.data;
        const healthPlanCosts = event.data.secondary.health_plan_costs;

        healthPlans['id'] = event.id;

        // inicia transação
        return await client.transaction(async trx => {
            try {
                // atualiza entidade principal
                const data = await client(`${schema}.health_plans`)
                    .where('id', '=', event.id)
                    .update(healthPlans)
                    .returning('*')
                    .transacting(trx);

                // verifica se o care team existe
                if (!data || data.length == 0) {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }

                // atualiza o grupo de médicos
                if (healthPlanCosts.length > 0) {
                    // exclui os médicos antigos
                    await client(`${schema}.health_plan_costs`)
                        .where('health_plan_id', '=', event.id)
                        .del()
                        .transacting(trx);

                    for (let i = 0; i < healthPlanCosts.length; i++) {
                        healthPlanCosts[i]['health_plan_id'] = event.id;
                    }

                    // insere os médicos novos
                    await client
                        .insert(healthPlanCosts)
                        .into(`${schema}.health_plan_costs`)
                        .transacting(trx);
                }

                event.data.main.data.id = event.id;

                return event.data.main.data;
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