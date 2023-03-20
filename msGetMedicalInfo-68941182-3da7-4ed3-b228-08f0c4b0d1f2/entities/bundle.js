async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam, basicType, costGroup) {
    if (basicType === 'price') {
        if (costGroup) {
            return await models.HealthPlanCosts.query()
                .where('group', costGroup)
                .orderBy('health_plan_id');
        } else {
            const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
            const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

            let prices;
            if (intSize) {
                prices = await models.HealthPlanCosts.query()
                    .orderBy('health_plan_id')
                    .limit(intSize)
                    .offset(intSize * intPage);
            } else {
                prices = await models.HealthPlanCosts.query()
                    .orderBy('health_plan_id');
            }

            return prices;
        }
    } else {
        throw utils.buildCustomError(400, 'Tipo de recurso inválido');
    }
}

module.exports = {
    execute
}