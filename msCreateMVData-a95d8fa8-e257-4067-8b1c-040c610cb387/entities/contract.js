async function execute(id, models, utils) {
    const data = await models.Contract.query()
        .where('id', id)
        .withGraphFetched('[companies.[company_locations, company_contacts], beneficiaries.[lives.[life_locations, life_contacts]], contracts_health_plans]');

    if (data.length > 0) {
        return data[0];
    } else {
        throw JSON.stringify(utils.buildCustomError(404, 'Recurso não encontrado'));
    }
}

module.exports = {
    execute
}