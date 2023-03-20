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

async function execute(id, models, utils, mergeOptions, _, type, identifier, db_schema, page, size, version) {
    if (id) {
        if (version) {
            const surveyConducts = await models.SurveyConduct
                .query()
                .where('id', id)
                .where('survey_version_number', version)
                .withGraphFetched('[survey_responses]');

            if (surveyConducts.length > 0) {
                surveyConducts[0].status = 'completed';
                return surveyConducts[0];
            } else {
                throw utils.buildCustomError(404, 'Recurso não encontrado');
            }
        } else {
            const surveyConducts = await models.SurveyConduct
                .query()
                .where('id', id)
                .withGraphFetched('[survey_responses]');

            if (surveyConducts.length > 0) {
                surveyConducts[0].status = 'completed';
                return surveyConducts[0];
            } else {
                throw utils.buildCustomError(404, 'Recurso não encontrado');
            }
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        if (version) {
            const surveyConducts = await models.SurveyConduct
                .query()
                .joinRelated('lives')
                .where(`lives.${response.attr}`, response.id)
                .where('survey_version_number', version)
                .withGraphFetched('[survey_responses]');

            if (surveyConducts.length > 0) {
                surveyConducts[0].status = 'completed';
                return surveyConducts[0];
            } else {
                throw utils.buildCustomError(404, 'Recurso não encontrado');
            }
        } else {
            const surveyConducts = await models.SurveyConduct
                .query()
                .joinRelated('lives')
                .where(`lives.${response.attr}`, response.id)
                .withGraphFetched('[survey_responses]');

            if (surveyConducts.length > 0) {
                surveyConducts[0].status = 'completed';
                return surveyConducts[0];
            } else {
                throw utils.buildCustomError(404, 'Recurso não encontrado');
            }
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let surveyConducts;
        if (intSize) {
            surveyConducts = await models.SurveyConduct
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage)
                .withGraphFetched('[survey_responses]');
        } else {
            surveyConducts = await models.SurveyConduct
                .query()
                .orderBy('id')
                .withGraphFetched('[survey_responses]');
        }

        for (let i = 0; i < surveyConducts.length; i++) {
            surveyConducts[i].status = 'completed';
        }

        return surveyConducts;
    }
}

module.exports = {
    execute
}