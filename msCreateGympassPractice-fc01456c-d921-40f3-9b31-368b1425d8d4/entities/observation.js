async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, holder) {
    if (id) {
        const observations = await models.Observation
            .query()
            .where('id', id);

        if (observations.length > 0) {
            return observations[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let observations;
        if (intSize) {
            observations = await models.Observation
                .query()
                .limit(intSize)
                .offset(intSize * intPage)
        } else {
            observations = await models.Observation
                .query();
        }

        return observations;
    }
}

module.exports = {
    execute
}