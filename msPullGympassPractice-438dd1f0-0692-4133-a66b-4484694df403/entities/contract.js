const utils = require('utils.js');

function unNest(contract, mergeOptions, _) {
    _.mergeWith(contract[0].lives, contract[0].lives.life_locations, mergeOptions);
    delete contract[0].lives.life_locations;

    _.mergeWith(contract[0].lives, contract[0].lives.life_contacts, mergeOptions);
    delete contract[0].lives.life_contacts;

    _.mergeWith(contract[0].companies, contract[0].companies.company_locations, mergeOptions);
    delete contract[0].companies.company_locations;
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

async function execute(id, models, utils, mergeOptions, _, organizationType, identifier, schema, page, size) {
    if (id) {
        const contract = await models.Contract.query()
            .where('id', id);

        if (contract.length > 0) {

            console.log(contract[0]);

            return contract[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {

        const response = getOmopIdentifier(identifier);

        const contract = await models.Contract.query()
            .joinRelated('companies')
            .where(`companies.${response.attr}`, response.id);

        if (contract.length > 0) {
            return contract[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let contracts;
        if (intSize) {
            contracts = await await models.Contract
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage);
        } else {
            contracts = await models.Contract
                .query()
                .orderBy('id');
        }

        return contracts;
    }
}

module.exports = {
    execute
}