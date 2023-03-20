function unNest(care_site, mergeOptions, _) {
    const originalLifeId = care_site.id;

    _.mergeWith(care_site, care_site.care_site_locations, mergeOptions);
    delete care_site.care_site_locations;

    _.mergeWith(care_site, care_site.care_site_contacts, mergeOptions);
    delete care_site.care_site_contacts;

    let array = []

    array = care_site.care_site_availability.map(item => {

        return {
            available_day_concept_id: parseInt(item.available_day_concept_id, 10),
            available_day_synonym_id: parseInt(item.available_day_synonym_id, 10),
            available_day_source_value: item.available_day_source_value,
            start_at: item.start_at,
            stop_at: item.stop_at
        };
    });

    care_site.care_site_availability = array;

    care_site.id = originalLifeId;
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
    }
}

function formatDates(dates) {
    return dates.map(item => {
        item.start_at = new Date(item.start_at).toISOString();
        item.stop_at = new Date(item.stop_at).toISOString();

        return item;

    });
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
    if (id) {
        const careSites = await models.CareSite
            .query()
            .where('id', id)
            .withGraphFetched('[care_site_locations, care_site_contacts, care_site_availability]');

        if (careSites.length > 0) {
            unNest(careSites[0], mergeOptions, _);
            careSites[0].care_site_availability = formatDates(careSites[0].care_site_availability);

            return careSites[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        const careSites = await models.CareSite
            .query()
            .where(response.attr, response.id)
            .withGraphFetched('[care_site_locations, care_site_contacts, care_site_availability]');

        if (careSites.length > 0) {
            unNest(careSites[0], mergeOptions, _);
            careSites[0].care_site_availability = formatDates(careSites[0].care_site_availability);
            return careSites[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let careSites;
        if (intSize) {
            careSites = await await models.CareSite
                .query()
                .orderBy('name')
                .limit(intSize)
                .offset(intSize * intPage)
                .withGraphFetched('[care_site_locations, care_site_contacts, care_site_availability]');
        } else {
            careSites = await models.CareSite
                .query()
                .orderBy('name')
                .withGraphFetched('[care_site_locations, care_site_contacts, care_site_availability]');
        }

        for (let i = 0; i < careSites.length; i++) {
            unNest(careSites[i], mergeOptions, _);
            careSites[i].care_site_availability = formatDates(careSites[i].care_site_availability);
        }

        return careSites;
    }
}

module.exports = {
    execute
}