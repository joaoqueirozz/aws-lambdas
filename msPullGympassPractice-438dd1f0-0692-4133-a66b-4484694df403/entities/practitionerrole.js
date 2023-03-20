async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size) {
    if (id) {
        const careSites = await models.CareSiteProvider.query()
            .where('id', id)

        if (careSites.length > 0) {
            return careSites[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let careSiteProviders;
        if (intSize) {
            careSiteProviders = await models.CareSiteProvider
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage);
        } else {
            careSiteProviders = await models.CareSiteProvider
                .query()
                .orderBy('id');
        }

        return careSiteProviders;
    }
}

module.exports = {
    execute
}