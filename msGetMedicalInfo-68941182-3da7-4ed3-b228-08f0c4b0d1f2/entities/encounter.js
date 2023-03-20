async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
    if (id) {
        const episodes = await models.Episode
            .query()
            .where('id', id);

        if (episodes.length > 0) {
            return episodes[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let episodes;
        if (intSize) {
            episodes = await models.Episode
                .query()
                .limit(intSize)
                .offset(intSize * intPage)
        } else {
            episodes = await models.Episode
                .query();
        }

        return episodes;
    }
}

module.exports = {
    execute
}