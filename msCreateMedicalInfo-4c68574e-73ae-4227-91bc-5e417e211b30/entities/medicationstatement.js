async function execute(models, event) { // O(f(n)) = 1 + 1 + 1 + 1 -> O(1)
    try {
        return (await models.DrugExposure.knex().insert(event.data.main.data, 'id').into(`${event.db_schema}.drug_exposures`).returning('*'))[0]; // 1
    } catch (err) {
        throw err; // 1
    } finally {
        models.destroy(); // 1
    }
}

module.exports = {
    execute
}