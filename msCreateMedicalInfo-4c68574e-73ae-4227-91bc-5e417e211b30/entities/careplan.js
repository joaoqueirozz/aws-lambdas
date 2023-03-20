async function execute(models, event) {
    try {
        return (await models.CarePlan.knex().insert(event.data.main.data).into(`${event.db_schema}.care_plans`).returning('*'))[0];
    } catch (err) {
        throw err;
    } finally {
        models.destroy();
    }
}

module.exports = {
    execute
}