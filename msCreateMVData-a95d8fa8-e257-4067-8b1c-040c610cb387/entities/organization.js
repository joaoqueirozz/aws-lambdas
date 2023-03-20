async function execute(id, models, utils) {
    const data = await models.Company.query()
        .where('id', id)
        .withGraphFetched('[company_locations, company_contacts]')

    if (data.length > 0) {
        return data[0];
    } else {
        throw JSON.stringify(utils.buildCustomError(404, 'Recurso não encontrado'));
    }
}

module.exports = {
    execute
}