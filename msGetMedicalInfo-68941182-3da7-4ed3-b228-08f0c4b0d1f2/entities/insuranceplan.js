function unNest(data, mergeOptions, _) {
    let array = []

    array = data.map(item => {
        return {
            age_low: parseInt(item.age_low, 10),
            age_high: parseInt(item.age_high, 10),
            cost: item.cost,
            currency: item.currency
        };
    });

    return array;
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {

    if (id) {
        const data = await models.HealthPlan
            .query()
            .where('id', id)
            .withGraphFetched('health_plan_costs');

        if (data.length > 0) {
            if (data[0]['health_plan_costs'])
                data[0]['health_plan_costs'] = unNest(data[0]['health_plan_costs'], mergeOptions, _);

            return data[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    }
    else if (queryParam && queryParam.healthcareservice_id) {
        let rawQuery = [];
        rawQuery.push(`select hp.* from ${schema}.care_sites cs `);
        rawQuery.push(`inner join ${schema}.health_plan_care_sites hpcs `);
        rawQuery.push(`on cs.id = hpcs.care_site_id `);
        rawQuery.push(`inner join ${schema}.health_plans hp `);
        rawQuery.push(`on hpcs.id = hp.health_plan_care_sites_id `);
        rawQuery.push(`where cs.id = ${queryParam.healthcareservice_id}`);
        rawQuery = rawQuery.join('');

        // executa a query 
        const data = (await models.CareSite.knex().raw(rawQuery)).rows;

        if (data) {
            for (let i = 0; i < data.length; i++) {

                const results = await models.HealthPlanCosts.query()
                    .where('health_plan_id', data[i].id)

                data[i]['health_plan_costs'] = unNest(results, mergeOptions, _);
            }

            return data;

        } else {
            return [];
        }
    }
    else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let data;
        if (intSize) {
            data = await models.HealthPlan
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage)
                .withGraphFetched('health_plan_costs');

        } else {
            data = await models.HealthPlan
                .query()
                .orderBy('id')
                .withGraphFetched('health_plan_costs');
        }

        for (let i = 0; i < data.length; i++) {
            data[i]['health_plan_costs'] = unNest(data[i]['health_plan_costs'], mergeOptions, _);
        }

        return data;
    }
}

module.exports = {
    execute
}