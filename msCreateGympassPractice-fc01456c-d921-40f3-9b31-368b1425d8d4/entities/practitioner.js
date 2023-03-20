function unNest(provider, mergeOptions, _) {
    const originalId = provider.id;

    _.mergeWith(provider, provider.provider_locations, mergeOptions);
    delete provider.provider_locations;

    _.mergeWith(provider, provider.provider_contacts, mergeOptions);
    delete provider.provider_contacts;

    provider.id = originalId;
}

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
        case './NamingSystem/conselhoRegional': {
            return {
                attr: 'national_provider_identification',
                id: document
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size) {
    if (id) {
        const provider = await models.Provider.query()
            .where('id', id)
            .withGraphFetched('[provider_locations, provider_contacts]');

        if (provider.length > 0) {
            unNest(provider[0], mergeOptions, _);
            return provider[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }

    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        const provider = await models.Provider.query()
            .where(response.attr, response.id)
            .withGraphFetched('[provider_locations, provider_contacts]');

        if (provider.length > 0) {
            unNest(provider[0], mergeOptions, _);
            return provider[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let providers;
        if (intSize) {
            providers = await models.Provider
                .query()
                .orderBy('name')
                .limit(intSize)
                .offset(intSize * intPage)
                .withGraphFetched('[provider_locations, provider_contacts]');
        } else {
            providers = await models.Provider
                .query()
                .orderBy('name')
                .withGraphFetched('[provider_locations, provider_contacts]');
        }

        for (let i = 0; i < providers.length; i++) {
            unNest(providers[i], mergeOptions, _);
        }

        return providers;
    }
}

module.exports = {
    execute
}