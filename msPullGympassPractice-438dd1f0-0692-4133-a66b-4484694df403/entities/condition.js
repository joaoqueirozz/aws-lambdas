async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size) {
    if (id) {
        const data = await models.Condition
            .query()
            .where('id', id);

        if (data.length > 0) {
            return data[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let data;
        if (intSize) {
            data = await await models.Condition
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage);
        } else {
            data = await models.Condition
                .query()
                .orderBy('id');
        }

        return data;
    }
}

module.exports = {
    execute
}