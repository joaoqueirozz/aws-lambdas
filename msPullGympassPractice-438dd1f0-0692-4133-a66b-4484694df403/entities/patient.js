function unNest(life, mergeOptions, _) {
    const originalLifeId = life.id;

    _.mergeWith(life, life.life_locations, mergeOptions);
    delete life.life_locations;

    _.mergeWith(life, life.life_contacts, mergeOptions);
    delete life.life_contacts;

    // delete life.id;

    life.id = originalLifeId;
}

function getOmopIdentifier(identifier) {
    const parts = identifier.split('/');
    const document = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/cartao_sus': {
            return {
                attr: 'national_health_identification_number',
                id: document
            }
        }
        case './NamingSystem/cpf': {
            return {
                attr: 'document_identification_primary',
                id: document
            }
        }
        case './NamingSystem/rg': {
            return {
                attr: 'document_identification_secondary',
                id: document
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, holder) {
    if (id) {
        const lives = await models.Life.query()
            .where('id', id)
            .withGraphFetched('[life_locations, life_contacts]');

        if (lives.length > 0) {
            unNest(lives[0], mergeOptions, _);
            return lives[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }

    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        const lives = await models.Life.query()
            .where(response.attr, response.id)
            .withGraphFetched('[life_locations, life_contacts]');

        if (lives.length > 0) {
            unNest(lives[0], mergeOptions, _);
            return lives[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (holder) {
        const lives = await models.Life.query()
            .where('holder_id', parseInt(holder, 10))
            .withGraphFetched('[life_locations, life_contacts]');

        for (let i = 0; i < lives.length; i++) {
            unNest(lives[i], mergeOptions, _);
        }

        return lives;
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let lives;
        if (intSize) {
            lives = await models.Life.query()
                .orderBy('name')
                .limit(intSize)
                .offset(intSize * intPage)
                .withGraphFetched('[life_locations, life_contacts]');
        } else {
            lives = await models.Life.query()
                .orderBy('name')
                .withGraphFetched('[life_locations, life_contacts]');
        }

        for (let i = 0; i < lives.length; i++) {
            unNest(lives[i], mergeOptions, _);
        }

        return lives;
    }
}

module.exports = {
    execute
}