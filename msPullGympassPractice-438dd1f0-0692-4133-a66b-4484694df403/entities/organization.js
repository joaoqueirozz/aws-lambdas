function unNest(result, mergeOptions, _, config) {
    const originalId = result.id;

    _.mergeWith(result, result[config.tablenames.location], mergeOptions);
    delete result[config.tablenames.location];

    // apenas |care_site| possui relacionamento com |contacts|
    // if (config.type === 'prov') {
        _.mergeWith(result, result[config.tablenames.contact], mergeOptions);
        delete result[config.tablenames.contact];
    // }

    // delete result.id;
    result.id = originalId;
}

function getConfig(models, organizationType) {
    switch (organizationType) {
        case 'ins': {
            return { // 1
                tablenames: {
                    main: "health_insurances",
                    location: "health_insurance_locations",
                    contact: "health_insurance_contacts"
                },
                foreignKey: 'health_insurance_id',
                model: models.HealthInsurance,
                eagerLoading: '[health_insurance_locations, health_insurance_contacts]',
                type: 'ins'
            }
        }
        case 'prov': {
            return {
                tablenames: {
                    main: "care_sites",
                    location: "care_site_locations",
                    contact: "care_site_contacts"
                },
                model: models.CareSite,
                eagerLoading: '[care_site_locations, care_site_contacts]',
                type: 'prov'
            }
        }
        case 'pay': {
            return {
                tablenames: {
                    main: "companies",
                    location: "company_locations",
                    contact: "company_contacts"
                },
                model: models.Company,
                eagerLoading: 'company_locations',
                eagerLoading: '[company_locations, company_contacts]',
                type: 'pay'
            }
        }
    }
}

function getOmopIdentifier(identifier) {
    const parts = identifier.split('/');
    const document = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/cnpj': {
            return {
                attr: 'document_identification_primary',
                id: document
            }
        }
        case './NamingSystem/national-code': {
            return {
                attr: 'national_code',
                id: document
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, organizationType, identifier, schema, page, size) {
    const config = getConfig(models, organizationType);

    if (id) {
        const results = await config.model.query()
            .where('id', id)
            .withGraphFetched(config.eagerLoading);

        if (results.length > 0) {
            unNest(results[0], mergeOptions, _, config);
            return results[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        const results = await config.model.query()
            .where(response.attr, response.id)
            .withGraphFetched(config.eagerLoading);

        if (results.length > 0) {
            unNest(results[0], mergeOptions, _, config);
            return results[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let results;
        if (intSize) {
            results = await await config.model
                .query()
                .orderBy('name')
                .limit(intSize)
                .offset(intSize * intPage)
                .withGraphFetched(config.eagerLoading);
        } else {
            results = await config.model
                .query()
                .orderBy('name')
                .withGraphFetched(config.eagerLoading);
        }

        for (let i = 0; i < results.length; i++) {
            unNest(results[i], mergeOptions, _, config);
        }

        return results;
    }
}

module.exports = {
    execute
}