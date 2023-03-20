const utils = require('utils.js');

async function execute(event, client) {
    try {
        event.data.main.data['id'] = event.id;

        let data;
        if (event.type === 'price') {
            data = await client(`${event.db_schema}.health_plan_costs`)
                .where('id', '=', event.id)
                .update(event.data.main.data)
                .returning('*');
        } else {
            data = await client(`${event.db_schema}.grace_types`)
                .where('id', '=', event.id)
                .update(event.data.main.data)
                .returning('*');
        }

        if (data && data.length > 0) {
            return data[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
}

async function executeBundle(models, event, trx) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    if (event.basicType === 'price') {
        // seta próximo valor para o grupo
        event.data.main.data.group = event.group;

        // grava no DW
        event.data.main.data.id = (await models.GraceType.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.health_plan_costs`).transacting(trx))[0]; // 1
    } else {
        event.data.main.data.id = (await models.GraceType.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.grace_types`).transacting(trx))[0]; // 1
    }

    return event.data.main.data;
}

module.exports = {
    execute,
    executeBundle
}