const utils = require('utils.js');


function getOmopIdentifier(identifier) {
    const parts = identifier.split('/');
    const document = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/cpf': {
            return {
                attr: 'document_identification_primary',
                id: document
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, organizationType, identifier, schema, page, size) {
    if (id) {
        const carePlan = await models.CarePlan
            .query()
            .where('id', id);

        if (carePlan.length > 0) {
            return carePlan[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        const carePlan = await models.CarePlan
            .query()
            .joinRelated('lives')
            .where(`lives.${response.attr}`, response.id);

        if (carePlan.length > 0) {
            return carePlan[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let carePlans;
        if (intSize) {
            carePlans = await await models.CarePlan
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage);
        } else {
            carePlans = await models.CarePlan
                .query()
                .orderBy('id');
        }

        return carePlans;
    }
}

module.exports = {
    execute
}