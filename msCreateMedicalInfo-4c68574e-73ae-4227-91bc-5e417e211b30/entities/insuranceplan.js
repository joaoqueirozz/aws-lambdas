async function executeTransaction(models, event, schema, trx) {
    try {
        // insere a empresa
        const ids = await models.HealthPlan.knex().insert(event.data.main.data, 'id').into(`${schema}.health_plans`).transacting(trx);

        // formata o id da empresa que acabou de ser inserida
        const insertedId = parseInt(ids[0], 10);

        let healthPlanCosts = Object.assign([], event.data.secondary.health_plan_costs);

        // atribui a referencia no array de custos 
        for (let i = 0; i < healthPlanCosts.length; i++) {
            healthPlanCosts[i]['health_plan_id'] = insertedId;
        }

        // insere os médicos no care team
        await models.HealthPlan.knex().insert(healthPlanCosts).into(`${schema}.health_plan_costs`).transacting(trx);
        event.data.main.data.id = insertedId.toString();

        return event.data.main.data;
    } catch (err) {
        throw err;
    } finally {
        models.destroy();
    }
}

async function execute(models, event) {
    // declara e inicializa o esquema
    const schema = event.db_schema;

    try {
        return await models.HealthPlan.knex().transaction(async trx => await executeTransaction(models, event, schema, trx));
    } catch (err) {
        throw err;
    } finally {
        models.destroy();
    }
}

module.exports = {
    execute
}