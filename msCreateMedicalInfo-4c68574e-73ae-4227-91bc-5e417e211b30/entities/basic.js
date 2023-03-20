let newGroupId;

async function execute(models, event) { // O(f(n)) = 1 + 1 + 1 + 1 -> O(1)
    try {
        if (event.type === 'price') {
            return (await models.GraceType.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.health_plan_costs`).returning('*'))[0]; // 1
        } else {
            return (await models.GraceType.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.grace_types`).returning('*'))[0]; // 1
        }
    } catch (err) {
        throw err; // 1
    } finally {
        models.destroy(); // 1
    }
}

async function getNextGroup(models, event, trx) {
    const query = `SELECT MAX (hpc.group) from ${event.db_schema}.health_plan_costs hpc`;
    return (await models.GraceType.knex().raw(query).transacting(trx)).rows[0].max + 1;
}

async function executeBundle(models, event, trx) { // O(f(n) = 1 + 1 + ... + n -> O(1)
    if (event.basicType === 'price') {
        // seta próximo valor para o grupo
        newGroupId = newGroupId || await getNextGroup(models, event, trx);
        event.data.main.data.group = newGroupId;

        // grava no DW
        event.data.main.data.id = (await models.GraceType.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.health_plan_costs`).transacting(trx).returning('*'))[0]; // 1
    } else {
        event.data.main.data.id = (await models.GraceType.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.grace_types`).transacting(trx).returning('*'))[0]; // 1
    }

    return event.data.main.data;
}

module.exports = {
    execute,
    executeBundle
}